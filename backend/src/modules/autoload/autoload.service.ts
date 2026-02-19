import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { TextRandomizer, spinOne, replaceMacros, randomizePhotos, countVariants } from './text-randomizer';

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
  // =============================================
  // MULTI-CATEGORY ARCHITECTURE (reyting.pro pattern)
  // =============================================

  /** Sync category tree from Avito API */
  async syncCategoryTree() {
    this.logger.log('Syncing Avito category tree...');
    try {
      const tree = await this.getCategoryTree();
      if (!tree?.categories) return { synced: 0 };

      let synced = 0;
      for (const cat of tree.categories) {
        await this.syncCategoryNode(cat, null, 0);
        synced++;
      }

      this.logger.log(`Category tree synced: ${synced} root categories`);
      return { synced };
    } catch (err) {
      this.logger.error('syncCategoryTree failed', err);
      throw new BadRequestException('Failed to sync category tree');
    }
  }

  private async syncCategoryNode(node: any, parentSlug: string | null, level: number) {
    const slug = node.slug || node.id?.toString();
    if (!slug) return;

    await this.prisma.autoloadCategory.upsert({
      where: { slug },
      update: {
        nameRu: node.name || node.title || slug,
        nameEn: node.name_en || null,
        parentSlug,
        path: node.path || node.name || slug,
        level,
        avitoId: node.id || 0,
        lastSyncAt: new Date(),
      },
      create: {
        slug,
        avitoId: node.id || 0,
        nameRu: node.name || node.title || slug,
        nameEn: node.name_en || null,
        parentSlug,
        path: node.path || node.name || slug,
        level,
        lastSyncAt: new Date(),
      },
    });

    // Recurse into children
    if (node.children?.length) {
      for (const child of node.children) {
        await this.syncCategoryNode(child, slug, level + 1);
      }
    }
  }

    /** Sync fields for a specific category from Avito API */
  async syncCategoryFields(categorySlug: string) {
    const category = await this.prisma.autoloadCategory.findUnique({
      where: { slug: categorySlug },
    });
    if (!category) throw new NotFoundException(`Category ${categorySlug} not found`);

    try {
      const fieldsData = await this.getCategoryFields(categorySlug);
      if (!fieldsData?.fields) return { synced: 0 };

      let synced = 0;
      for (const field of fieldsData.fields) {
        const fieldSlug = field.slug || field.name_en || field.name;
        await this.prisma.autoloadCategoryField.upsert({
          where: { categoryId_slug: { categoryId: category.id, slug: fieldSlug } },
          update: {
            name: field.name || fieldSlug,
            nameEn: field.name_en || null,
            fieldType: field.type || 'text',
            isRequired: field.required || false,
            description: field.description || null,
            defaultValue: field.default_value || null,
            options: field.values || null,
            group: field.group || null,
            catalogUrl: field.catalog_url || null,
            sortOrder: synced,
          },
          create: {
            categoryId: category.id,
            slug: fieldSlug,
            name: field.name || fieldSlug,
            nameEn: field.name_en || null,
            fieldType: field.type || 'text',
            isRequired: field.required || false,
            description: field.description || null,
            defaultValue: field.default_value || null,
            options: field.values || null,
            group: field.group || null,
            catalogUrl: field.catalog_url || null,
            sortOrder: synced,
          },
        });
        synced++;
      }

      await this.prisma.autoloadCategory.update({
        where: { id: category.id },
        data: { fieldsCount: synced, lastSyncAt: new Date() },
      });

      return { categorySlug, synced };
    } catch (err) {
      this.logger.error(`syncCategoryFields failed for ${categorySlug}`, err);
      throw new BadRequestException('Failed to sync category fields');
    }
  }

    // === Category CRUD ===

  async getCategories(parentSlug?: string) {
    const where = parentSlug ? { parentSlug } : { level: 0 };
    return this.prisma.autoloadCategory.findMany({
      where: { ...where, isActive: true },
      orderBy: { nameRu: 'asc' },
      include: { _count: { select: { fields: true, items: true } } },
    });
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.prisma.autoloadCategory.findUnique({
      where: { slug },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { items: true } },
      },
    });
    if (!category) throw new NotFoundException(`Category ${slug} not found`);
    return category;
  }

  async getCategoryFieldsBySlug(slug: string) {
    const category = await this.prisma.autoloadCategory.findUnique({
      where: { slug },
    });
    if (!category) throw new NotFoundException(`Category ${slug} not found`);

    return this.prisma.autoloadCategoryField.findMany({
      where: { categoryId: category.id },
      orderBy: { sortOrder: 'asc' },
    });
  }

    // === Items CRUD (per category tab) ===

  async getItems(projectId: string, categoryId?: string, skip = 0, take = 50) {
    const where: any = { projectId };
    if (categoryId) where.categoryId = categoryId;

    const [data, total] = await Promise.all([
      this.prisma.autoloadItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { nameRu: true, slug: true } } },
        skip,
        take,
      }),
      this.prisma.autoloadItem.count({ where }),
    ]);
    return { data, total, skip, take };
  }

  async getItem(id: string) {
    const item = await this.prisma.autoloadItem.findUnique({
      where: { id },
      include: {
        category: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }

  async createItem(data: {
    projectId: string;
    accountId?: string;
    categoryId: string;
    externalId: string;
    title: string;
    description?: string;
    price?: number;
    imageUrls?: string[];
    address?: string;
    contactPhone?: string;
    contactName?: string;
    condition?: string;
    adStatus?: string;
    listingFee?: string;
    deliveryMode?: string;
    categoryFields?: Record<string, any>;
    dateBegin?: Date;
    dateEnd?: Date;
  }) {
    // Validate category exists
    const category = await this.prisma.autoloadCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) throw new NotFoundException(`Category ${data.categoryId} not found`);

    return this.prisma.autoloadItem.create({
      data: {
        projectId: data.projectId,
        accountId: data.accountId,
        categoryId: data.categoryId,
        externalId: data.externalId,
        title: data.title,
        description: data.description,
        price: data.price || 0,
        imageUrls: data.imageUrls || [],
        address: data.address,
        contactPhone: data.contactPhone,
        contactName: data.contactName,
        condition: data.condition,
        adStatus: data.adStatus,
        listingFee: data.listingFee,
        deliveryMode: data.deliveryMode,
        categoryFields: data.categoryFields ?? undefined,
        dateBegin: data.dateBegin,
        dateEnd: data.dateEnd,
        status: 'draft',
      },
    });
  }

    async updateItem(id: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    imageUrls: string[];
    address: string;
    contactPhone: string;
    contactName: string;
    condition: string;
    adStatus: string;
    listingFee: string;
    deliveryMode: string;
    categoryFields: Record<string, any>;
    status: string;
    isActive: boolean;
    dateBegin: Date;
    dateEnd: Date;
  }>) {
    const item = await this.prisma.autoloadItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return this.prisma.autoloadItem.update({ where: { id }, data });
  }

  async deleteItem(id: string) {
    const item = await this.prisma.autoloadItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return this.prisma.autoloadItem.delete({ where: { id } });
  }

  async bulkCreateItems(projectId: string, categoryId: string, items: any[]) {
    const category = await this.prisma.autoloadCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);

    const results = { created: 0, errors: [] as any[] };

    for (const item of items) {
      try {
        await this.prisma.autoloadItem.upsert({
          where: { projectId_externalId: { projectId, externalId: item.externalId } },
          update: {
            title: item.title,
            description: item.description,
            price: item.price || 0,
            imageUrls: item.imageUrls || [],
            categoryFields: item.categoryFields ?? undefined,
            status: item.status || 'draft',
          },
          create: {
            projectId,
            categoryId,
            externalId: item.externalId,
            title: item.title,
            description: item.description,
            price: item.price || 0,
            imageUrls: item.imageUrls || [],
            address: item.address,
            condition: item.condition,
            categoryFields: item.categoryFields ?? undefined,
            status: 'draft',
          },
        });
        results.created++;
      } catch (err: any) {
        results.errors.push({ externalId: item.externalId, error: err.message });
      }
    }

    return results;
  }

    // === Feed Management ===

  async getFeeds(projectId: string) {
    return this.prisma.autoloadFeed.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFeed(data: {
    projectId: string;
    accountId: string;
    name: string;
    format?: string;
    categoryIds?: string[];
  }) {
    return this.prisma.autoloadFeed.create({
      data: {
        projectId: data.projectId,
        accountId: data.accountId,
        name: data.name,
        format: data.format || 'xlsx',
        categoryIds: data.categoryIds || [],
      },
    });
  }

  async updateFeed(id: string, data: Partial<{
    name: string;
    format: string;
    categoryIds: string[];
    isActive: boolean;
  }>) {
    return this.prisma.autoloadFeed.update({ where: { id }, data });
  }

  async deleteFeed(id: string) {
    return this.prisma.autoloadFeed.delete({ where: { id } });
  }

  /** Get items count grouped by category for a project */
  async getItemsStats(projectId: string) {
    const categories = await this.prisma.autoloadCategory.findMany({
      where: {
        items: { some: { projectId } },
      },
      include: {
        _count: { select: { items: true } },
        items: {
          where: { projectId },
          select: { status: true },
        },
      },
    });

    return categories.map((cat) => ({
      categoryId: cat.id,
      slug: cat.slug,
      nameRu: cat.nameRu,
      total: cat._count.items,
      active: cat.items.filter((i) => i.status === 'active').length,
      draft: cat.items.filter((i) => i.status === 'draft').length,
      error: cat.items.filter((i) => i.status === 'error').length,
    }));
  }

    // =============================================
  // TEMPLATE MANAGEMENT
  // =============================================

  /** Create a new spintax template */
  async createTemplate(data: {
    projectId: string;
    categoryId?: string;
    name: string;
    type: string;
    spintaxBody: string;
    macros?: any;
  }) {
    // Validate spintax
    const validation = TextRandomizer.validate(data.spintaxBody);
    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid spintax: ${validation.errors.join(', ')}`,
      );
    }

    return this.prisma.autoloadTemplate.create({ data });
  }

  /** Update an existing template */
  async updateTemplate(id: string, data: {
    name?: string;
    type?: string;
    spintaxBody?: string;
    macros?: any;
    isActive?: boolean;
  }) {
    if (data.spintaxBody) {
      const validation = TextRandomizer.validate(data.spintaxBody);
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid spintax: ${validation.errors.join(', ')}`,
        );
      }
    }
    return this.prisma.autoloadTemplate.update({
      where: { id },
      data,
    });
  }

  /** Get all templates for a project */
  async getTemplates(projectId: string, categoryId?: string) {
    return this.prisma.autoloadTemplate.findMany({
      where: {
        projectId,
        ...(categoryId ? { categoryId } : {}),
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get a single template by ID */
  async getTemplate(id: string) {
    const tmpl = await this.prisma.autoloadTemplate.findUnique({ where: { id } });
    if (!tmpl) throw new NotFoundException('Template not found');
    return tmpl;
  }

  /** Delete a template */
  async deleteTemplate(id: string) {
    return this.prisma.autoloadTemplate.delete({ where: { id } });
  }

    // =============================================
  // PHOTO POOL MANAGEMENT
  // =============================================

  /** Create a photo pool */
  async createPhotoPool(data: {
    projectId: string;
    categoryId?: string;
    name: string;
    urls: string[];
    minPhotos?: number;
    maxPhotos?: number;
  }) {
    return this.prisma.autoloadPhotoPool.create({ data });
  }

  /** Update a photo pool */
  async updatePhotoPool(id: string, data: {
    name?: string;
    urls?: string[];
    minPhotos?: number;
    maxPhotos?: number;
    isActive?: boolean;
  }) {
    return this.prisma.autoloadPhotoPool.update({
      where: { id },
      data,
    });
  }

  /** Get all photo pools for a project */
  async getPhotoPools(projectId: string, categoryId?: string) {
    return this.prisma.autoloadPhotoPool.findMany({
      where: {
        projectId,
        ...(categoryId ? { categoryId } : {}),
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Delete a photo pool */
  async deletePhotoPool(id: string) {
    return this.prisma.autoloadPhotoPool.delete({ where: { id } });
  }

    // =============================================
  // TEXT RANDOMIZATION
  // =============================================

  /** Preview randomized text without saving */
  async previewRandomization(data: {
    projectId: string;
    categoryId?: string;
    titleTemplateId?: string;
    descriptionTemplateId?: string;
    photoPoolId?: string;
    macros?: Record<string, string | string[]>;
    sampleCount?: number;
  }) {
    const titleTemplate = data.titleTemplateId
      ? await this.getTemplate(data.titleTemplateId)
      : null;
    const descTemplate = data.descriptionTemplateId
      ? await this.getTemplate(data.descriptionTemplateId)
      : null;
    const photoPool = data.photoPoolId
      ? await this.prisma.autoloadPhotoPool.findUnique({
          where: { id: data.photoPoolId },
        })
      : null;

    const options = {
      titleTemplate: titleTemplate?.spintaxBody,
      descriptionTemplate: descTemplate?.spintaxBody,
      macros: {
        ...(titleTemplate?.macros as Record<string, any> || {}),
        ...(descTemplate?.macros as Record<string, any> || {}),
        ...(data.macros || {}),
      },
      photoPool: photoPool
        ? { urls: photoPool.urls, minPhotos: photoPool.minPhotos, maxPhotos: photoPool.maxPhotos }
        : undefined,
    };

    return TextRandomizer.preview(options, data.sampleCount || 3);
  }

    /**
   * Apply randomization: generate N items from templates and save to DB.
   * This is the main method for mass-generating unique listings.
   */
  async applyRandomization(data: {
    projectId: string;
    categoryId: string;
    accountId: string;
    titleTemplateId?: string;
    descriptionTemplateId?: string;
    photoPoolId?: string;
    macros?: Record<string, string | string[]>;
    count: number;
    baseFields?: Record<string, any>;
  }) {
    const titleTemplate = data.titleTemplateId
      ? await this.getTemplate(data.titleTemplateId)
      : null;
    const descTemplate = data.descriptionTemplateId
      ? await this.getTemplate(data.descriptionTemplateId)
      : null;
    const photoPool = data.photoPoolId
      ? await this.prisma.autoloadPhotoPool.findUnique({
          where: { id: data.photoPoolId },
        })
      : null;

    const options = {
      titleTemplate: titleTemplate?.spintaxBody,
      descriptionTemplate: descTemplate?.spintaxBody,
      macros: {
        ...(titleTemplate?.macros as Record<string, any> || {}),
        ...(descTemplate?.macros as Record<string, any> || {}),
        ...(data.macros || {}),
      },
      photoPool: photoPool
        ? { urls: photoPool.urls, minPhotos: photoPool.minPhotos, maxPhotos: photoPool.maxPhotos }
        : undefined,
      count: data.count,
    };

    const generated = TextRandomizer.generateMany(options, data.count);

    // Save generated items to DB
    const items = [];
    for (const item of generated) {
      const created = await this.prisma.autoloadItem.create({
        data: {
          projectId: data.projectId,
          categoryId: data.categoryId,
          accountId: data.accountId,
          externalId: `gen-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          title: item.title,
          description: item.description,
          images: item.photos,
          fields: data.baseFields || {},
          status: 'draft',
        },
      });
      items.push(created);
    }

    this.logger.log(
      `Generated ${items.length} randomized items for project ${data.projectId}`,
    );

    return {
      generated: items.length,
      totalPossibleVariants: countVariants(
        (titleTemplate?.spintaxBody || '') + (descTemplate?.spintaxBody || ''),
      ),
      items,
    };
  }

    /** Validate a spintax template string */
  validateTemplate(template: string) {
    return TextRandomizer.validate(template);
  }

  /** Quick spin - resolve spintax once without saving */
  spinText(template: string, macros?: Record<string, string | string[]>) {
    let text = template;
    if (macros) text = replaceMacros(text, macros);
    return spinOne(text);
  }

}
