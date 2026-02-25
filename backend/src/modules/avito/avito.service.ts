import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { decrypt, encrypt } from '../../common/utils/crypto';
import axios from 'axios';

const AVITO_API = 'https://api.avito.ru';
const AVITO_TOKEN_URL = 'https://api.avito.ru/token';

@Injectable()
export class AvitoService {
  private readonly logger = new Logger(AvitoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // === Token Management ===

  private decryptMaybe(value?: string | null): string | null {
    if (!value) return null;
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }

  private encryptMaybe(value?: string | null): string | null {
    if (!value) return null;
    return encrypt(value);
  }

  private async getValidToken(accountId: string, userId?: string): Promise<string> {
    if (!accountId) throw new BadRequestException('accountId is required');

    const account = userId
      ? await this.assertAccountAccess(userId, accountId)
      : await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });

    if (!account) {
      throw new NotFoundException(`AvitoAccount ${accountId} not found`);
    }

    const accessToken = this.decryptMaybe(account.access_token);
    if (!accessToken) {
      throw new BadRequestException('No access token for this account');
    }

    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      return this.refreshToken(accountId, userId);
    }

    return accessToken;
  }

  async refreshToken(accountId: string, userId?: string): Promise<string> {
    const account = userId
      ? await this.assertAccountAccess(userId, accountId)
      : await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });

    const refreshToken = this.decryptMaybe(account?.refresh_token);
    if (!account || !refreshToken) {
      throw new BadRequestException(
        'Cannot refresh token: no refresh token available',
      );
    }

    const refreshClientId =
      account.client_id || this.configService.get<string>('AVITO_CLIENT_ID');
    const clientSecret =
      this.decryptMaybe(account.client_secret) ||
      this.configService.get<string>('AVITO_CLIENT_SECRET');
    if (!refreshClientId || !clientSecret) {
      throw new BadRequestException(
        'AVITO_CLIENT_ID and AVITO_CLIENT_SECRET must be configured',
      );
    }

    try {
      const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: refreshClientId,
        client_secret: clientSecret,
      });

      const response = await axios.post(AVITO_TOKEN_URL, form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;
      await this.prisma.avitoAccount.update({
        where: { id: accountId },
        data: {
          access_token: this.encryptMaybe(access_token),
          refresh_token: this.encryptMaybe(
            refresh_token || refreshToken,
          ),
          token_expires_at: new Date(Date.now() + expires_in * 1000),
          updated_at: new Date(),
        },
      });
      return access_token;
    } catch (error) {
      this.logger.error(`Token refresh failed for ${accountId}`, error);
      throw new BadRequestException('Token refresh failed');
    }
  }

  // === OAuth ===

  async handleCallback(code: string, projectId: string, userId?: string) {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    let ownerProfileId: string;
    if (userId) {
      await this.assertProjectAccess(userId, projectId);
      ownerProfileId = await this.resolveOwnerProfileId(userId);
    } else {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, ownerId: true },
      });
      if (!project) {
        throw new NotFoundException(`Project "${projectId}" not found`);
      }
      ownerProfileId = await this.resolveOwnerProfileId(project.ownerId);
    }

    const clientId = this.configService.get<string>('AVITO_CLIENT_ID');
    const clientSecret = this.configService.get<string>('AVITO_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('AVITO_REDIRECT_URI');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'AVITO_CLIENT_ID and AVITO_CLIENT_SECRET must be configured',
      );
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    });
    if (redirectUri) {
      form.set('redirect_uri', redirectUri);
    }

    const tokenResponse = await axios.post(AVITO_TOKEN_URL, form.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const existingAccount = await this.prisma.avitoAccount.findFirst({
      where: {
        user_id: ownerProfileId,
        client_id: clientId,
      },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });

    const account = existingAccount
      ? await this.prisma.avitoAccount.update({
          where: { id: existingAccount.id },
          data: {
            client_secret: this.encryptMaybe(clientSecret),
            access_token: this.encryptMaybe(access_token),
            refresh_token: this.encryptMaybe(refresh_token),
            token_expires_at: new Date(Date.now() + expires_in * 1000),
            is_active: true,
            updated_at: new Date(),
          },
        })
      : await this.prisma.avitoAccount.create({
          data: {
            user_id: ownerProfileId,
            account_name: `Avito ${new Date().toISOString().split('T')[0]}`,
            client_id: clientId,
            client_secret: this.encryptMaybe(clientSecret),
            access_token: this.encryptMaybe(access_token),
            refresh_token: this.encryptMaybe(refresh_token),
            token_expires_at: new Date(Date.now() + expires_in * 1000),
            is_active: true,
          },
        });

    return { accountId: account.id, success: true };
  }

  // === Status ===

  async getStatus(userId: string, projectId: string) {
    await this.assertProjectAccess(userId, projectId);
    const ownerProfileId = await this.resolveOwnerProfileId(userId);

    const accounts = await this.prisma.avitoAccount.findMany({
      where: { user_id: ownerProfileId, is_active: true },
      select: {
        id: true,
        account_name: true,
        is_active: true,
        token_expires_at: true,
        created_at: true,
      },
    });
    return {
      connected: accounts.length > 0,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.account_name,
        active: a.is_active,
        tokenValid: a.token_expires_at ? new Date(a.token_expires_at) > new Date() : false,
        tokenExpiresAt: a.token_expires_at,
        createdAt: a.created_at,
      })),
    };
  }

  // === Accounts ===

  async connectAccount(
    userId: string,
    projectId: string,
    clientId?: string,
    clientSecret?: string,
  ) {
    await this.assertProjectAccess(userId, projectId);
    const ownerProfileId = await this.resolveOwnerProfileId(userId);

    const account = await this.prisma.avitoAccount.create({
      data: {
        user_id: ownerProfileId,
        account_name: `Avito Account ${new Date().toISOString().split('T')[0]}`,
        client_id: clientId,
        client_secret: this.encryptMaybe(clientSecret),
        is_active: true,
      },
    });
    return { id: account.id, name: account.account_name, created: true };
  }

  async getAccounts(userId: string, projectId: string) {
    await this.assertProjectAccess(userId, projectId);
    const ownerProfileId = await this.resolveOwnerProfileId(userId);
    return this.prisma.avitoAccount.findMany({
      where: { user_id: ownerProfileId },
      select: {
        id: true,
        account_name: true,
        is_active: true,
        created_at: true,
        token_expires_at: true,
        client_id: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAccountById(userId: string, accountId: string) {
    return this.assertAccountAccess(userId, accountId);
  }

  // === Items/Listings ===

  async getItems(
    userId: string,
    accountId: string,
    options?: { page?: number; per_page?: number; status?: string },
  ) {
    const token = await this.getValidToken(accountId, userId);
    try {
      const response = await axios.get(`${AVITO_API}/core/v1/items`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: options?.page || 1,
          per_page: options?.per_page || 25,
          status: options?.status,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get items for account ${accountId}`, error);
      return { resources: [], meta: { page: 1, per_page: 25, total: 0 } };
    }
  }

  async getItemById(userId: string, accountId: string, itemId: string) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.get(`${AVITO_API}/core/v1/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getItemStats(userId: string, accountId: string, itemId: string) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.get(`${AVITO_API}/core/v1/items/${itemId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // === Bids ===

  async createBid(
    userId: string,
    accountId: string,
    itemId: string,
    bidAmount: number,
    vasPackage?: string,
  ) {
    const token = await this.getValidToken(accountId, userId);
    try {
      const response = await axios.post(
        `${AVITO_API}/core/v1/items/${itemId}/vas`,
        { vas_package: vasPackage || 'x2_1', amount: bidAmount },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const listing = await this.prisma.listings.findFirst({
        where: {
          avito_account_id: accountId,
          avito_item_id: itemId,
        },
        select: { id: true },
      });
      if (listing) {
        await this.prisma.bids.create({
          data: {
            listing_id: listing.id,
            target_position: 1,
            max_bid: bidAmount,
            current_bid: bidAmount,
            is_active: true,
            strategy: 'maintain',
          },
        });
      }
      return response.data;
    } catch (error) {
      this.logger.error('Bid creation failed', error);
      throw new BadRequestException('Failed to create bid');
    }
  }

  async getBids(userId: string, accountId: string, itemId?: string) {
    await this.assertAccountAccess(userId, accountId);
    const where: any = {
      listings: { avito_account_id: accountId },
    };
    if (itemId) {
      where.listings = {
        avito_account_id: accountId,
        avito_item_id: itemId,
      };
    }
    return this.prisma.bids.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async getBidsBalance(userId: string, accountId: string) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.get(`${AVITO_API}/core/v1/accounts/self/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // === Messages ===

  async getMessages(
    userId: string,
    accountId: string,
    options?: { unreadOnly?: boolean; itemId?: string },
  ) {
    const token = await this.getValidToken(accountId, userId);
    try {
      const response = await axios.get(`${AVITO_API}/messenger/v2/accounts/self/chats`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          unread_only: options?.unreadOnly || false,
          item_id: options?.itemId,
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get messages', error);
      return { chats: [] };
    }
  }

  async getChatMessages(userId: string, accountId: string, chatId: string) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.get(
      `${AVITO_API}/messenger/v2/accounts/self/chats/${chatId}/messages`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  }

  async sendMessage(
    userId: string,
    accountId: string,
    chatId: string,
    messageText: string,
  ) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.post(
      `${AVITO_API}/messenger/v1/accounts/self/chats/${chatId}/messages`,
      { message: { text: messageText }, type: 'text' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  // === Analytics ===

  async getAnalytics(userId: string, accountId: string, dateFrom?: string, dateTo?: string) {
    const token = await this.getValidToken(accountId, userId);
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const response = await axios.get(`${AVITO_API}/core/v1/accounts/self/stats`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Analytics fetch failed', error);
      return { stats: [] };
    }
  }

  // === Webhooks ===

  async registerWebhook(
    userId: string,
    accountId: string,
    webhookUrl: string,
    events?: string[],
  ) {
    const token = await this.getValidToken(accountId, userId);
    const response = await axios.post(
      `${AVITO_API}/core/v1/webhooks`,
      { url: webhookUrl, events: events || ['new_message', 'item_sold', 'bid_won'] },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  private async assertProjectAccess(userId: string, projectId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
  }

  private async assertAccountAccess(userId: string, accountId: string) {
    const account = await this.prisma.avitoAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const ownerProfileId = await this.resolveOwnerProfileId(userId);
    if (account.user_id !== ownerProfileId) {
      throw new ForbiddenException('You do not have access to this account');
    }

    return account;
  }

  private async resolveOwnerProfileId(userId: string): Promise<string> {
    const profileById = await this.prisma.profiles.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (profileById) {
      return profileById.id;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user?.email) {
      throw new BadRequestException('Cannot resolve profile for current user');
    }

    const profileByEmail = await this.prisma.profiles.findFirst({
      where: {
        email: {
          equals: user.email,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });
    if (!profileByEmail) {
      throw new BadRequestException(
        'No matching profile found for current user email',
      );
    }

    return profileByEmail.id;
  }
}
