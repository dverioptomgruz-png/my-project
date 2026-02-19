import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

const AVITO_API = 'https://api.avito.ru';

@Injectable()
export class AutoloadService {
  private readonly logger = new Logger(AutoloadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  // =============================================
  // INTERNAL ENDPOINTS FOR N8N
  // =============================================

  /** GET /internal/projects/:projectId/items - returns items for n8n autoload */
  async getItemsForAutoload(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const accounts = await this.prisma.avitoAccount.findMany({
      where: { user_id: projectId, is_active: true },
      include: { listings: { where: { status: 'active' } } },
    });

    const items = accounts.flatMap((account) =>
      account.listings.map((listing) => ({
        account_id: account.id,
        user_id: projectId,
        item_id: listing.avito_item_id,
        title: listing.title,
        price: listing.price ? Number(listing.price) : 0,
        category: listing.category || '',
        status: listing.status,
      })),
    );

    return { project_id: projectId, items, total: items.length };
  }

  /** GET /internal/accounts/:accountId/token - returns valid Avito token for n8n */
  async getTokenForAccount(accountId: string) {
    const account = await this.prisma.avitoAccount.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (!account.access_token) throw new BadRequestException('No access token');

    // Refresh if expired
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      const newToken = await this.refreshToken(accountId);
      return { access_token: newToken, account_id: accountId };
    }

    return { access_token: account.access_token, account_id: accountId };
  }

  /** POST /autoload-runs - saves autoload run result from n8n */
  async saveAutoloadRun(data: {
    user_id?: string;
    account_id?: string;
    total_items: number;
    success_count: number;
    failed_count: number;
    error_details?: any;
  }) {
    return this.prisma.autoloadRun.create({
      data: {
        userId: data.user_id,
        accountId: data.account_id,
        totalItems: data.total_items,
        successCount: data.success_count,
        failedCount: data.failed_count,
        errorDetails: data.error_details ?? undefined,
        source: 'n8n',
        status: data.failed_count > 0 ? 'completed_with_errors' : 'completed',
        finishedAt: new Date(),
      },
    });
  }

  /** POST /n8n/logs - system logging from n8n */
  async saveN8nLog(data: {
    event: string;
    level?: string;
    message?: string;
    module?: string;
    data?: any;
    userId?: string;
    projectId?: string;
  }) {
    return this.prisma.systemEventLog.create({
      data: {
        event: data.event || 'n8n_log',
        level: data.level || 'info',
        message: data.message,
        module: data.module || 'autoload',
        data: data.data ?? undefined,
        userId: data.userId,
        projectId: data.projectId,
      },
    });
  }

  // =============================================
  // AVITO AUTOLOAD API METHODS
  // =============================================

  private async getValidToken(accountId: string): Promise<string> {
    const account = await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException(`Account ${accountId} not found`);
    if (!account.access_token) throw new BadRequestException('No access token');
    if (account.token_expires_at && new Date(account.token_expires_at) < new Date()) {
      return this.refreshToken(accountId);
    }
    return account.access_token;
  }

  async refreshToken(accountId: string): Promise<string> {
    const account = await this.prisma.avitoAccount.findUnique({ where: { id: accountId } });
    if (!account?.refresh_token) throw new BadRequestException('No refresh token');
    try {
      const res = await axios.post('https://api.avito.ru/token', {
        grant_type: 'refresh_token',
        refresh_token: account.refresh_token,
        client_id: account.client_id || this.configService.get('AVITO_CLIENT_ID'),
        client_secret: account.client_secret || this.configService.get('AVITO_CLIENT_SECRET'),
      });
      const { access_token, refresh_token, expires_in } = res.data;
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
    } catch (err) {
      this.logger.error(`Token refresh failed for ${accountId}`, err);
      throw new BadRequestException('Token refresh failed');
    }
  }

  // === Autoload Profile (Avito API v2) ===

  async getAutoloadProfile(accountId: string) {
    const token = await this.getValidToken(accountId);
    try {
      const res = await axios.get(`${AVITO_API}/autoload/v2/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Sync to local DB
      await this.prisma.autoloadProfile.upsert({
        where: { accountId },
        update: {
          enabled: res.data.autoload_enabled,
          feedUrl: res.data.feeds_data?.[0]?.url || null,
          reportEmail: res.data.report_email,
          schedule: res.data.schedule || null,
          lastSyncAt: new Date(),
        },
        create: {
          accountId,
          enabled: res.data.autoload_enabled,
          feedUrl: res.data.feeds_data?.[0]?.url || null,
          reportEmail: res.data.report_email,
          schedule: res.data.schedule || null,
          lastSyncAt: new Date(),
        },
      });
      return res.data;
    } catch (err) {
      this.logger.error(`getAutoloadProfile failed for ${accountId}`, err);
      throw new BadRequestException('Failed to get autoload profile');
    }
  }

  async updateAutoloadProfile(accountId: string, body: {
    autoload_enabled: boolean;
    feeds_data?: { name: string; url: string }[];
    report_email: string;
    schedule: { time_from: number; time_to: number; limit: number }[];
    agreement?: boolean;
  }) {
    const token = await this.getValidToken(accountId);
    try {
      const res = await axios.post(`${AVITO_API}/autoload/v2/profile`, body, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      // Sync to local DB
      await this.prisma.autoloadProfile.upsert({
        where: { accountId },
        update: {
          enabled: body.autoload_enabled,
          feedUrl: body.feeds_data?.[0]?.url || null,
          reportEmail: body.report_email,
          schedule: body.schedule || null,
          lastSyncAt: new Date(),
        },
        create: {
          accountId,
          enabled: body.autoload_enabled,
          feedUrl: body.feeds_data?.[0]?.url || null,
          reportEmail: body.report_email,
          schedule: body.schedule || null,
          lastSyncAt: new Date(),
        },
      });
      return { success: true, data: res.data };
    } catch (err) {
      this.logger.error(`updateAutoloadProfile failed`, err);
      throw new BadRequestException('Failed to update autoload profile');
    }
  }

  // === Upload Trigger ===

  async triggerUpload(accountId: string) {
    const token = await this.getValidToken(accountId);
    try {
      const res = await axios.post(`${AVITO_API}/autoload/v1/upload`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      this.logger.log(`Upload triggered for account ${accountId}`);
      return { success: true, data: res.data };
    } catch (err) {
      this.logger.error(`triggerUpload failed`, err);
      throw new BadRequestException(err?.response?.data?.error?.message || 'Upload trigger failed');
    }
  }

  // === Reports (Avito API v2/v3) ===

  async getAvitoReports(accountId: string, page = 0, perPage = 50) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/reports`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, per_page: perPage },
    });
    return res.data;
  }

  async getAvitoReportById(accountId: string, reportId: number) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v3/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async getLastCompletedReport(accountId: string) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v3/reports/last_completed_report`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  }

  async getReportItems(accountId: string, reportId: number, page = 0, perPage = 50) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/reports/${reportId}/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, per_page: perPage },
    });
    return res.data;
  }

  async getReportItemsFees(accountId: string, reportId: number, page = 0, perPage = 100) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/reports/${reportId}/items/fees`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, per_page: perPage },
    });
    return res.data;
  }

  // === Items Info & ID Mapping ===

  async getItemsInfo(accountId: string, query: string) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/reports/items`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { query },
    });
    return res.data;
  }

  async getAdIdsByAvitoIds(accountId: string, query: string) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/items/ad_ids`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { query },
    });
    return res.data;
  }

  async getAvitoIdsByAdIds(accountId: string, query: string) {
    const token = await this.getValidToken(accountId);
    const res = await axios.get(`${AVITO_API}/autoload/v2/items/avito_ids`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { query },
    });
    return res.data;
  }

  // === Category Tree ===

  async getCategoryTree() {
    const res = await axios.get(`${AVITO_API}/autoload/v1/user-docs/tree`);
    return res.data;
  }

  async getCategoryFields(nodeSlug: string) {
    const res = await axios.get(`${AVITO_API}/autoload/v1/user-docs/node/${nodeSlug}/fields`);
    return res.data;
  }

  // =============================================
  // LOCAL DB OPERATIONS
  // =============================================

  async getReports(projectId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.autoloadReport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
        skip,
        take,
      }),
      this.prisma.autoloadReport.count({ where: { projectId } }),
    ]);
    return { data, total, skip, take };
  }

  async getReport(id: string) {
    const report = await this.prisma.autoloadReport.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!report) throw new NotFoundException(`AutoloadReport "${id}" not found`);
    return report;
  }

  async createReport(data: {
    projectId: string;
    accountId?: string;
    total: number;
    ok: number;
    failed: number;
    status?: string;
    source?: string;
    rawJson?: any;
  }) {
    return this.prisma.autoloadReport.create({
      data: {
        projectId: data.projectId,
        accountId: data.accountId,
        total: data.total,
        ok: data.ok,
        failed: data.failed,
        status: data.status || 'completed',
        source: data.source || 'n8n',
        rawJson: data.rawJson ?? undefined,
      },
    });
  }

  async getAutoloadRuns(accountId?: string, skip = 0, take = 50) {
    const where = accountId ? { accountId } : {};
    const [data, total] = await Promise.all([
      this.prisma.autoloadRun.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.autoloadRun.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  // =============================================
  // CRON: Sync reports from Avito every 30 min
  // =============================================

  @Cron(CronExpression.EVERY_30_MINUTES)
  async syncAutoloadReports() {
    this.logger.log('CRON: Starting autoload reports sync...');
    try {
      const activeAccounts = await this.prisma.avitoAccount.findMany({
        where: { is_active: true, access_token: { not: null } },
      });

      for (const account of activeAccounts) {
        try {
          const lastReport = await this.getLastCompletedReport(account.id);
          if (!lastReport?.report_id) continue;

          // Check if we already have this report
          const existing = await this.prisma.autoloadReport.findFirst({
            where: { rawJson: { path: ['report_id'], equals: lastReport.report_id } },
          });
          if (existing) continue;

          // Find project for this account
          const projectMember = await this.prisma.project.findFirst({
            where: { ownerId: account.user_id },
          });

          await this.prisma.autoloadReport.create({
            data: {
              projectId: projectMember?.id || account.user_id,
              accountId: account.id,
              total: lastReport.section_stats?.count || 0,
              ok: lastReport.events?.filter((e: any) => e.type === 'ok')?.length || 0,
              failed: lastReport.events?.filter((e: any) => e.type === 'error')?.length || 0,
              status: lastReport.status || 'completed',
              source: lastReport.source || 'avito_sync',
              startedAt: lastReport.started_at ? new Date(lastReport.started_at) : null,
              finishedAt: lastReport.finished_at ? new Date(lastReport.finished_at) : null,
              rawJson: lastReport,
            },
          });

          this.logger.log(`Synced report ${lastReport.report_id} for account ${account.id}`);
        } catch (err) {
          this.logger.warn(`Failed to sync reports for account ${account.id}: ${err.message}`);
        }
      }

      this.logger.log('CRON: Autoload reports sync completed');
    } catch (err) {
      this.logger.error('CRON: syncAutoloadReports failed', err);
    }
  }
}
