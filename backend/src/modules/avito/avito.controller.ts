import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  BadRequestException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AvitoService } from './avito.service';
import { Public } from '../../common/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('Avito')
@Controller('avito')
export class AvitoController {
  private readonly logger = new Logger(AvitoController.name);

  constructor(
    private readonly avitoService: AvitoService,
    private readonly configService: ConfigService,
  ) {}

  // === OAuth Endpoints ===

  @Get('oauth/start')
  @Public()
  @ApiOperation({ summary: 'Start Avito OAuth flow' })
  async startOAuth(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }

    const clientId = this.configService.get('AVITO_CLIENT_ID');
    const redirectUri = this.configService.get('AVITO_REDIRECT_URI');
    const scope =
      this.configService.get('AVITO_OAUTH_SCOPE') ||
      this.configService.get('AVITO_SCOPE');
    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'AVITO_CLIENT_ID and AVITO_REDIRECT_URI must be configured',
      );
    }

    const state = Buffer.from(
      JSON.stringify({ projectId, issuedAt: Date.now() }),
    ).toString('base64');
    const scopePart = scope ? `&scope=${encodeURIComponent(scope)}` : '';
    const url =
      `https://www.avito.ru/oauth?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `${scopePart}` +
      `&state=${encodeURIComponent(state)}`;

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
      throw new BadRequestException('Both "code" and "state" query parameters are required');
    }

    let projectId = '';
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
      if (decoded && typeof decoded.projectId === 'string') {
        projectId = decoded.projectId;
      }
    } catch {
      // Ignore parse error here and let service validate callback payload.
    }

    const frontendUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    const successRedirect = projectId
      ? `${frontendUrl}/app/projects/${projectId}/avito?connected=true`
      : `${frontendUrl}/app/connect-avito?success=true`;
    const failureRedirectBase = projectId
      ? `${frontendUrl}/app/projects/${projectId}/avito?connected=false`
      : `${frontendUrl}/app/connect-avito?success=false`;

    try {
      const result = await this.avitoService.handleCallback(code, state);
      const redirectUrl = `${successRedirect}&accountId=${encodeURIComponent(result.accountId)}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.error(`Avito OAuth callback failed: ${message}`);
      return res.redirect(`${failureRedirectBase}&error=${encodeURIComponent(message)}`);
    }
  }

  // === Status ===

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito connection status' })
  async getStatus(@Query('projectId') projectId: string) {
    return this.avitoService.getStatus(projectId);
  }

  // === n8n Integration API Endpoints ===

  @Post('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Connect Avito account' })
  async connectAccount(
    @Body() body: { projectId: string; clientId?: string; clientSecret?: string },
  ) {
    return this.avitoService.connectAccount(body.projectId, body.clientId, body.clientSecret);
  }

  @Get('accounts')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get connected Avito accounts' })
  async getAccounts(@Query('projectId') projectId: string) {
    return this.avitoService.getAccounts(projectId);
  }

  @Get('items')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito listings' })
  async getItems(
    @Query('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('status') status?: string,
  ) {
    return this.avitoService.getItems(accountId, { page: Number(page) || 1, per_page: Number(perPage) || 25, status });
  }

  @Post('bids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create bid on Avito item' })
  async createBid(
    @Body() body: { accountId: string; itemId: string; bidAmount: number; vasPackage?: string },
  ) {
    return this.avitoService.createBid(body.accountId, body.itemId, body.bidAmount, body.vasPackage);
  }

  @Get('bids')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bids for account' })
  async getBids(
    @Query('accountId') accountId: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.avitoService.getBids(accountId, itemId);
  }

  @Get('messages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito messages' })
  async getMessages(
    @Query('accountId') accountId: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('itemId') itemId?: string,
  ) {
    return this.avitoService.getMessages(accountId, { unreadOnly: unreadOnly === 'true', itemId });
  }

  @Get('analytics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Avito account analytics' })
  async getAnalytics(
    @Query('accountId') accountId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.avitoService.getAnalytics(accountId, dateFrom, dateTo);
  }

  @Get('item-stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get item statistics' })
  async getItemStats(
    @Query('accountId') accountId: string,
    @Query('itemId') itemId: string,
  ) {
    return this.avitoService.getItemStats(accountId, itemId);
  }

  @Post('webhooks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register webhook' })
  async registerWebhook(
    @Body() body: { accountId: string; webhookUrl: string; events?: string[] },
  ) {
    return this.avitoService.registerWebhook(body.accountId, body.webhookUrl, body.events);
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
