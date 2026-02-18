import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
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

  private async getValidToken(accountId: string): Promise<string> {
    if (!accountId) throw new BadRequestException("accountId is required");
    const account = await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`AvitoAccount ${accountId} not found`);
    if (!account.access_token) throw new BadRequestException('No access token for this account');

    // Check if token expired
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      return this.refreshToken(accountId);
    }
    return account.access_token;
  }

  async refreshToken(accountId: string): Promise<string> {
    const account = await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });
    if (!account || !account.refresh_token) {
      throw new BadRequestException('Cannot refresh token: no refresh token available');
    }

    try {
      const response = await axios.post(AVITO_TOKEN_URL, {
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        client_id: account.client_id || this.configService.get('AVITO_CLIENT_ID'),
        client_secret: account.client_secret || this.configService.get('AVITO_CLIENT_SECRET'),
      });

      const { access_token, refresh_token, expires_in } = response.data;
      await this.prisma.avitoAccount.update({
        where: { id: accountId },
        data: {
          access_token,
          refresh_token: refresh_token || account.refresh_token,
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

  async handleCallback(code: string, state: string) {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { projectId } = stateData;

    const clientId = this.configService.get('AVITO_CLIENT_ID');
    const clientSecret = this.configService.get('AVITO_CLIENT_SECRET');

    const tokenResponse = await axios.post(AVITO_TOKEN_URL, {
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const account = await this.prisma.avitoAccount.create({
      data: {
        user_id: projectId,
        account_name: `Avito ${new Date().toISOString().split('T')[0]}`,
        client_id: clientId,
        client_secret: clientSecret,
        access_token,
        refresh_token,
        token_expires_at: new Date(Date.now() + expires_in * 1000),
        is_active: true,
      },
    });

    return { accountId: account.id, success: true };
  }

  // === Status ===

  async getStatus(projectId: string) {
    const accounts = await this.prisma.avitoAccount.findMany({
      where: { user_id: projectId, is_active: true },
      select: { id: true, account_name: true, is_active: true, token_expires_at: true, created_at: true },
    });
    return {
      connected: accounts.length > 0,
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.account_name,
        active: a.is_active,
        tokenValid: a.token_expires_at ? new Date(a.token_expires_at) > new Date() : false,
      })),
    };
  }

  // === Accounts ===

  async connectAccount(projectId: string, clientId?: string, clientSecret?: string) {
    const account = await this.prisma.avitoAccount.create({
      data: {
        user_id: projectId,
        account_name: `Avito Account ${new Date().toISOString().split('T')[0]}`,
        client_id: clientId,
        client_secret: clientSecret,
        is_active: true,
      },
    });
    return { id: account.id, name: account.account_name, created: true };
  }

  async getAccounts(projectId?: string) {
    const where = projectId ? { user_id: projectId } : {};
    return this.prisma.avitoAccount.findMany({
      where,
      select: { id: true, account_name: true, is_active: true, created_at: true, token_expires_at: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async getAccountById(accountId: string) {
    const account = await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    return account;
  }

  // === Items/Listings ===

  async getItems(accountId: string, options?: { page?: number; per_page?: number; status?: string }) {
    const token = await this.getValidToken(accountId);
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

  async getItemById(accountId: string, itemId: string) {
    const token = await this.getValidToken(accountId);
    const response = await axios.get(`${AVITO_API}/core/v1/items/${itemId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async getItemStats(accountId: string, itemId: string) {
    const token = await this.getValidToken(accountId);
    const response = await axios.get(`${AVITO_API}/core/v1/items/${itemId}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // === Bids ===

  async createBid(accountId: string, itemId: string, bidAmount: number, vasPackage?: string) {
    const token = await this.getValidToken(accountId);
    try {
      const response = await axios.post(
        `${AVITO_API}/core/v1/items/${itemId}/vas`,
        { vas_package: vasPackage || 'x2_1', amount: bidAmount },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Store in local DB
      await this.prisma.bids.create({
        data: {
          listing_id: itemId,
          target_position: 1,
          max_bid: bidAmount,
          current_bid: bidAmount,
          is_active: true,
          strategy: 'maintain',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Bid creation failed`, error);
      throw new BadRequestException('Failed to create bid');
    }
  }

  async getBids(accountId: string, itemId?: string) {
        const where: any = {};
    if (itemId) where.listing_id = itemId;
    return this.prisma.bids.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async getBidsBalance(accountId: string) {
    const token = await this.getValidToken(accountId);
    const response = await axios.get(`${AVITO_API}/core/v1/accounts/self/balance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  // === Messages ===

  async getMessages(accountId: string, options?: { unreadOnly?: boolean; itemId?: string }) {
    const token = await this.getValidToken(accountId);
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
      this.logger.error(`Failed to get messages`, error);
      return { chats: [] };
    }
  }

  async getChatMessages(accountId: string, chatId: string) {
    const token = await this.getValidToken(accountId);
    const response = await axios.get(`${AVITO_API}/messenger/v2/accounts/self/chats/${chatId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }

  async sendMessage(accountId: string, chatId: string, messageText: string) {
    const token = await this.getValidToken(accountId);
    const response = await axios.post(
      `${AVITO_API}/messenger/v1/accounts/self/chats/${chatId}/messages`,
      { message: { text: messageText }, type: 'text' },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }

  // === Analytics ===

  async getAnalytics(accountId: string, dateFrom?: string, dateTo?: string) {
    const token = await this.getValidToken(accountId);
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
      this.logger.error(`Analytics fetch failed`, error);
      return { stats: [] };
    }
  }

  // === Webhooks ===

  async registerWebhook(accountId: string, webhookUrl: string, events?: string[]) {
    const token = await this.getValidToken(accountId);
    const response = await axios.post(
      `${AVITO_API}/core/v1/webhooks`,
      { url: webhookUrl, events: events || ['new_message', 'item_sold', 'bid_won'] },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return response.data;
  }
}