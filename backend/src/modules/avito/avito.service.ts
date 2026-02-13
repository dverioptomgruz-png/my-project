import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { encrypt, decrypt } from '../../common/utils/crypto';
import { AvitoAccountStatus } from '@prisma/client';

interface AvitoTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: string;
}

interface EncryptedTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO date string
}

@Injectable()
export class AvitoService {
  private readonly logger = new Logger(AvitoService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Build the Avito OAuth authorization URL.
   * The `state` parameter carries the projectId so it can be recovered in the callback.
   */
  getAuthUrl(projectId: string): string {
    const clientId = this.config.get<string>('AVITO_CLIENT_ID');
    const redirectUri = this.config.get<string>('AVITO_REDIRECT_URI');
    const authUrl = this.config.get<string>(
      'AVITO_AUTH_URL',
      'https://www.avito.ru/oauth',
    );

    if (!clientId || !redirectUri) {
      throw new InternalServerErrorException(
        'Avito OAuth is not configured (missing AVITO_CLIENT_ID or AVITO_REDIRECT_URI)',
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: projectId,
    });

    return `${authUrl}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for access & refresh tokens, then
   * encrypt and persist them against the project's AvitoAccount.
   */
  async handleCallback(code: string, state: string): Promise<string> {
    const projectId = state;

    // Verify the project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }

    const tokens = await this.exchangeCodeForTokens(code);

    const encryptedPayload = this.encryptTokens(tokens);

    // Upsert: create or update the AvitoAccount for this project
    await this.prisma.avitoAccount.upsert({
      where: {
        id: await this.findOrGenerateAccountId(projectId),
      },
      create: {
        projectId,
        status: AvitoAccountStatus.ACTIVE,
        tokensEncrypted: encryptedPayload,
        scopes: [],
      },
      update: {
        status: AvitoAccountStatus.ACTIVE,
        tokensEncrypted: encryptedPayload,
      },
    });

    this.logger.log(`Avito account connected for project ${projectId}`);

    return projectId;
  }

  /**
   * Refresh tokens for a given AvitoAccount.
   * Loads encrypted tokens from DB, decrypts, calls the Avito refresh endpoint,
   * re-encrypts and saves the new tokens.
   */
  async refreshToken(accountId: string): Promise<{ success: boolean }> {
    const account = await this.prisma.avitoAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`AvitoAccount "${accountId}" not found`);
    }

    if (!account.tokensEncrypted) {
      throw new BadRequestException(
        'No tokens stored for this Avito account. Please reconnect via OAuth.',
      );
    }

    const storedTokens = this.decryptTokens(account.tokensEncrypted);

    const newTokens = await this.refreshAccessToken(storedTokens.refreshToken);

    const encryptedPayload = this.encryptTokens(newTokens);

    await this.prisma.avitoAccount.update({
      where: { id: accountId },
      data: {
        tokensEncrypted: encryptedPayload,
        status: AvitoAccountStatus.ACTIVE,
      },
    });

    this.logger.log(`Tokens refreshed for AvitoAccount ${accountId}`);

    return { success: true };
  }

  /**
   * Return a safe status summary of Avito accounts for a project.
   * Never exposes actual tokens.
   */
  async getStatus(projectId: string) {
    const accounts = await this.prisma.avitoAccount.findMany({
      where: { projectId },
      select: {
        id: true,
        avitoUserId: true,
        title: true,
        status: true,
        scopes: true,
        tokensEncrypted: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return accounts.map((account) => {
      let tokenExpiresAt: string | null = null;

      if (account.tokensEncrypted) {
        try {
          const payload = this.decryptTokens(account.tokensEncrypted);
          tokenExpiresAt = payload.expiresAt;
        } catch {
          // If decryption fails the account is in a broken state
          tokenExpiresAt = null;
        }
      }

      return {
        id: account.id,
        avitoUserId: account.avitoUserId,
        title: account.title,
        status: account.status,
        scopes: account.scopes,
        tokenExpiresAt,
        connected: account.status === AvitoAccountStatus.ACTIVE,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      };
    });
  }

  // ── Private helpers ──────────────────────────────────

  /**
   * Exchange an authorization code for tokens via POST to the Avito token endpoint.
   */
  private async exchangeCodeForTokens(code: string): Promise<AvitoTokens> {
    const clientId = this.config.get<string>('AVITO_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('AVITO_CLIENT_SECRET', '');
    const apiBaseUrl = this.config.get<string>(
      'AVITO_API_BASE_URL',
      'https://api.avito.ru',
    );

    const response = await fetch(`${apiBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Avito token exchange failed (${response.status}): ${errorBody}`,
      );
      throw new BadRequestException(
        'Failed to exchange authorization code for tokens with Avito',
      );
    }

    return response.json() as Promise<AvitoTokens>;
  }

  /**
   * Use a refresh token to obtain new access & refresh tokens.
   */
  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<AvitoTokens> {
    const clientId = this.config.get<string>('AVITO_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('AVITO_CLIENT_SECRET', '');
    const apiBaseUrl = this.config.get<string>(
      'AVITO_API_BASE_URL',
      'https://api.avito.ru',
    );

    const response = await fetch(`${apiBaseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Avito token refresh failed (${response.status}): ${errorBody}`,
      );
      throw new BadRequestException(
        'Failed to refresh Avito tokens. The account may need to be reconnected.',
      );
    }

    return response.json() as Promise<AvitoTokens>;
  }

  /**
   * Encrypt an AvitoTokens response into a single encrypted string for DB storage.
   */
  private encryptTokens(tokens: AvitoTokens): string {
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    const payload: EncryptedTokenPayload = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
    };

    return encrypt(JSON.stringify(payload));
  }

  /**
   * Decrypt the stored encrypted token string back to a structured payload.
   */
  private decryptTokens(encryptedStr: string): EncryptedTokenPayload {
    try {
      const json = decrypt(encryptedStr);
      return JSON.parse(json) as EncryptedTokenPayload;
    } catch (error) {
      this.logger.error('Failed to decrypt Avito tokens', error);
      throw new InternalServerErrorException(
        'Failed to decrypt stored tokens. The encryption key may have changed.',
      );
    }
  }

  /**
   * Find an existing AvitoAccount ID for the project, or return a new cuid-style
   * placeholder so Prisma upsert can handle both create and update paths.
   */
  private async findOrGenerateAccountId(projectId: string): Promise<string> {
    const existing = await this.prisma.avitoAccount.findFirst({
      where: { projectId },
      select: { id: true },
    });

    // Return existing ID or a deterministic "not-found" ID that will trigger
    // the `create` branch of the upsert.
    return existing?.id ?? 'new-avito-account-placeholder';
  }
}
