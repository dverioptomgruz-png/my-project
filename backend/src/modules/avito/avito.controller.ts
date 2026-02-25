import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  BadRequestException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { AvitoService } from './avito.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

type OAuthStatePayload = {
  userId: string;
  projectId: string;
  issuedAt: number;
};

@ApiTags('Avito')
@Controller('avito')
export class AvitoController {
  private readonly oauthStateTtlMs = 10 * 60 * 1000;
  private readonly logger = new Logger(AvitoController.name);

  constructor(
    private readonly avitoService: AvitoService,
    private readonly configService: ConfigService,
  ) {}

  // === OAuth Endpoints ===

  @Get('oauth/start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start Avito OAuth flow' })
  async startOAuth(
    @CurrentUser('sub') userId: string,
    @Query('projectId') projectId: string,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }
    await this.avitoService.getAccounts(userId, projectId);
    const clientId = this.configService.get('AVITO_CLIENT_ID');
    const redirectUri = this.configService.get('AVITO_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'AVITO_CLIENT_ID and AVITO_REDIRECT_URI must be configured',
      );
    }

    const state = this.signState({
      userId,
      projectId,
      issuedAt: Date.now(),
    });

    const url = `https://www.avito.ru/oauth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return { url };
  }

  @Get('oauth/callback')
  @Public()
  @ApiOperation({ summary: 'Avito OAuth callback' })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException(
        'Both "code" and "state" query parameters are required',
      );
    }

    let parsedState: OAuthStatePayload;
    try {
      parsedState = this.verifyState(state);
      const ageMs = Date.now() - parsedState.issuedAt;
      if (ageMs < 0 || ageMs > this.oauthStateTtlMs) {
        throw new BadRequestException('OAuth state expired');
      }
    } catch (error) {
      throw new BadRequestException('Invalid OAuth state');
    }

    try {
      const result = await this.avitoService.handleCallback(
        code,
        parsedState.projectId,
        parsedState.userId,
      );
      const frontendUrl =
        this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      return res.redirect(
        `${frontendUrl}/app/projects/${parsedState.projectId}/avito?connected=true&accountId=${result.accountId}`,
      );
    } catch (error) {
      const frontendUrl =
        this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      const message = this.extractErrorMessage(error);
      this.logger.error(
        `OAuth callback failed for project ${parsedState.projectId}: ${message}`,
      );
      return res.redirect(
        `${frontendUrl}/app/projects/${parsedState.projectId}/avito?connected=false&error=${encodeURIComponent(message)}`,
      );
    }
  }

  // === Status ===

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito connection status' })
  async getStatus(
    @CurrentUser('sub') userId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.avitoService.getStatus(userId, projectId);
  }

  // === Integration Endpoints ===

  @Post('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect Avito account' })
  async connectAccount(
    @CurrentUser('sub') userId: string,
    @Body() body: { projectId: string; clientId?: string; clientSecret?: string },
  ) {
    return this.avitoService.connectAccount(
      userId,
      body.projectId,
      body.clientId,
      body.clientSecret,
    );
  }

  @Get('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get connected Avito accounts' })
  async getAccounts(
    @CurrentUser('sub') userId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.avitoService.getAccounts(userId, projectId);
  }

  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token for Avito account' })
  async refreshAccountToken(
    @CurrentUser('sub') userId: string,
    @Body() body: { accountId: string },
  ) {
    const accessToken = await this.avitoService.refreshToken(body.accountId, userId);
    return { refreshed: true, accessTokenPresent: !!accessToken };
  }

  @Get('items')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito listings' })
  async getItems(
    @CurrentUser('sub') userId: string,
    @Query('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.avitoService.getItems(userId, accountId, {
      page: Number(page) || 1,
      per_page: Number(perPage) || 25,
      status,
    });
  }

  @Post('bids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create bid on Avito item' })
  async createBid(
    @CurrentUser('sub') userId: string,
    @Body() body: {
      accountId: string;
      itemId: string;
      bidAmount: number;
      vasPackage?: string;
    },
  ) {
    return this.avitoService.createBid(
      userId,
      body.accountId,
      body.itemId,
      body.bidAmount,
      body.vasPackage,
    );
  }

  @Get('bids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bids for account' })
  async getBids(
    @CurrentUser('sub') userId: string,
    @Query('accountId') accountId: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.avitoService.getBids(userId, accountId, itemId);
  }

  @Get('messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito messages' })
  async getMessages(
    @CurrentUser('sub') userId: string,
    @Query('accountId') accountId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.avitoService.getMessages(userId, accountId, {
      unreadOnly: unreadOnly === 'true',
      itemId,
    });
  }

  @Get('analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito account analytics' })
  async getAnalytics(
    @CurrentUser('sub') userId: string,
    @Query('accountId') accountId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.avitoService.getAnalytics(userId, accountId, dateFrom, dateTo);
  }

  @Get('item-stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get item statistics' })
  async getItemStats(
    @CurrentUser('sub') userId: string,
    @Query('accountId') accountId: string,
    @Query('itemId') itemId: string,
  ) {
    return this.avitoService.getItemStats(userId, accountId, itemId);
  }

  @Post('webhooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register webhook' })
  async registerWebhook(
    @CurrentUser('sub') userId: string,
    @Body() body: { accountId: string; webhookUrl: string; events?: string[] },
  ) {
    return this.avitoService.registerWebhook(
      userId,
      body.accountId,
      body.webhookUrl,
      body.events,
    );
  }

  private signState(payload: OAuthStatePayload): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.getStateSecret())
      .update(encodedPayload)
      .digest('base64url');
    return `${encodedPayload}.${signature}`;
  }

  private verifyState(state: string): OAuthStatePayload {
    const parts = state.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid state format');
    }
    const [encodedPayload, receivedSignature] = parts;
    const expectedSignature = createHmac('sha256', this.getStateSecret())
      .update(encodedPayload)
      .digest('base64url');

    const a = Buffer.from(receivedSignature);
    const b = Buffer.from(expectedSignature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid state signature');
    }

    const payloadRaw = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    return JSON.parse(payloadRaw) as OAuthStatePayload;
  }

  private getStateSecret(): string {
    const stateSecret =
      this.configService.get<string>('AVITO_OAUTH_STATE_SECRET') ||
      this.configService.get<string>('JWT_SECRET');
    if (!stateSecret) {
      throw new Error(
        'AVITO_OAUTH_STATE_SECRET or JWT_SECRET must be configured',
      );
    }
    return stateSecret;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        response &&
        typeof response === 'object' &&
        'message' in response &&
        typeof (response as { message?: unknown }).message === 'string'
      ) {
        return (response as { message: string }).message;
      }
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Avito OAuth callback failed';
  }
}
