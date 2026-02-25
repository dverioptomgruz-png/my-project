import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AvitoService } from '../avito/avito.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CRMConnectorService } from './crm-connector.service';
import { YandexDiskService } from './yandex-disk.service';
import { ImageAIService } from './image-ai.service';

@Injectable()
export class ABTesterService {
  private readonly logger = new Logger(ABTesterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avitoService: AvitoService,
    private readonly crmConnector: CRMConnectorService,
    private readonly yandexDisk: YandexDiskService,
    private readonly imageAI: ImageAIService,
  ) {}

  private async assertProjectAccess(userId: string, projectId?: string | null) {
    if (!projectId) return;
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }
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
      throw new BadRequestException('Cannot resolve profile for experiment owner');
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
      throw new BadRequestException('Owner profile not found by email');
    }

    return profileByEmail.id;
  }

  // ========== EXPERIMENT MANAGEMENT ==========

  async createExperiment(userId: string, data: any) {
    await this.assertProjectAccess(userId, data.projectId);
    const experiment = await this.prisma.aBExperiment.create({
      data: {
        userId,
        projectId: data.projectId,
        name: data.name,
        category: data.category,
        baseTitle: data.baseTitle,
        baseDescription: data.baseDescription,
        basePrice: data.basePrice || 0,
        baseImages: data.baseImages || [],
        duration: data.duration || 7,
        rotationInterval: data.rotationInterval || 24,
        status: 'draft',
      },
    });

    // Create variants if provided
    if (data.variants && data.variants.length > 0) {
      for (let i = 0; i < data.variants.length; i++) {
        const v = data.variants[i];
        await this.prisma.aBVariant.create({
          data: {
            experimentId: experiment.id,
            name: v.name || `Variant ${i + 1}`,
            index: i,
            title: v.title || data.baseTitle,
            description: v.description || data.baseDescription,
            price: v.price || data.basePrice || 0,
            images: v.images || data.baseImages || [],
          },
        });
      }
    }

    return this.prisma.aBExperiment.findUnique({
      where: { id: experiment.id },
      include: { variants: true },
    });
  }

  async getExperiments(userId: string, projectId?: string, status?: string) {
    const where: any = { userId };
    if (projectId) {
      await this.assertProjectAccess(userId, projectId);
      where.projectId = projectId;
    }
    if (status) where.status = status;
    return this.prisma.aBExperiment.findMany({
      where,
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExperimentById(userId: string, experimentId: string) {
    const exp = await this.prisma.aBExperiment.findFirst({
      where: { id: experimentId, userId },
      include: { variants: { orderBy: { index: 'asc' } } },
    });
    if (!exp) throw new NotFoundException('Experiment not found');
    return exp;
  }

  async startExperiment(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    if (exp.variants.length < 2) {
      throw new BadRequestException('Need at least 2 variants to start');
    }
    const updated = await this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'testing',
        startedAt: new Date(),
        currentVariantIndex: 0,
      },
      include: { variants: true },
    });

    try {
      await this.publishVariant(userId, experimentId, 0);
    } catch (error: any) {
      this.logger.warn(`Failed to queue first variant for experiment ${experimentId}: ${error.message}`);
    }

    return updated;
  }

  async stopExperiment(userId: string, experimentId: string) {
    await this.getExperimentById(userId, experimentId);
    return this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: { status: 'completed', stoppedAt: new Date() },
      include: { variants: true },
    });
  }

  async deleteExperiment(userId: string, experimentId: string) {
    await this.getExperimentById(userId, experimentId);
    await this.prisma.aBVariant.deleteMany({ where: { experimentId } });
    return this.prisma.aBExperiment.delete({ where: { id: experimentId } });
  }

  // ========== CRM INTEGRATION ==========
  // Тестировщик получает доступ к CRM, собирает данные о продукте
  // и автоматически создаёт эксперимент

  async createFromCRM(userId: string, data: any) {
    const { crmSource, productQuery, projectId, connectionId, yandexDiskUrl } = data;

    // 1. Поиск продукта в CRM
    let crmProducts: any[] = [];
    if (crmSource && productQuery) {
      crmProducts = await this.crmConnector.searchProducts(crmSource, connectionId || projectId, productQuery);
    }

    // 2. Загрузка фото с Яндекс.Диска (если ссылка)
    let diskImages: string[] = [];
    if (yandexDiskUrl) {
      const files = await this.yandexDisk.getFilesFromPublicFolder(yandexDiskUrl);
      diskImages = files.filter((url: any) => typeof url === 'string' && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url));
    }

    // 3. Создаём эксперименты для каждого продукта из CRM
    const experiments: any[] = [];
    for (const product of crmProducts) {
      const images = diskImages.length > 0 ? diskImages : (product.images || []);

      const exp = await this.createExperiment(userId, {
        projectId,
        name: `A/B: ${product.name}`,
        category: product.category || 'general',
        baseTitle: product.name,
        baseDescription: product.description || '',
        basePrice: product.price || 0,
        baseImages: images,
        duration: 7,
        rotationInterval: 24,
      });
      experiments.push(exp);
    }

    return {
      experiments,
      crmProductsFound: crmProducts.length,
      diskImagesFound: diskImages.length,
    };
  }

  // ========== AI HYPOTHESIS GENERATION ==========

  async generateHypotheses(data: any) {
    const { category, baseTitle, baseDescription, basePrice } = data;
    // AI generates title/description/price variants
    const hypotheses = [
      {
        name: 'Price Test - Lower',
        title: baseTitle,
        description: baseDescription,
        price: basePrice * 0.9,
        reasoning: 'Lower price may increase conversion rate',
      },
      {
        name: 'Price Test - Higher',
        title: baseTitle,
        description: baseDescription,
        price: basePrice * 1.1,
        reasoning: 'Higher price may signal premium quality',
      },
      {
        name: 'Title Optimization',
        title: `${baseTitle} | Premium`,
        description: baseDescription,
        price: basePrice,
        reasoning: 'Adding premium tag may attract quality seekers',
      },
    ];
    return { hypotheses, generatedAt: new Date().toISOString() };
  }

  // ========== STATS & ANALYSIS ==========

  async getExperimentStats(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    const variants = exp.variants.map((v: any) => {
      const ctr = v.views > 0 ? ((v.contacts / v.views) * 100).toFixed(2) : '0.00';
      return { ...v, ctr: parseFloat(ctr) };
    });
    const totalViews = variants.reduce((s: number, v: any) => s + v.views, 0);
    const totalContacts = variants.reduce((s: number, v: any) => s + v.contacts, 0);
    return {
      experiment: { ...exp, variants },
      summary: { totalViews, totalContacts, variantsCount: variants.length },
    };
  }

  async determineWinner(
    userId: string,
    experimentId: string,
    options?: {
      minTotalViews?: number;
      minVariantViews?: number;
      allowLowSample?: boolean;
    },
  ) {
    const exp = await this.getExperimentById(userId, experimentId);
    if (!exp.variants.length) {
      throw new BadRequestException('Experiment has no variants');
    }

    const minTotalViews = options?.minTotalViews ?? 50;
    const minVariantViews = options?.minVariantViews ?? 20;
    const allowLowSample = options?.allowLowSample ?? false;

    const totalViews = exp.variants.reduce((sum: number, v: any) => sum + (v.views || 0), 0);
    if (!allowLowSample && totalViews < minTotalViews) {
      throw new BadRequestException(
        `Not enough data yet. Collected ${totalViews} views, require at least ${minTotalViews}`,
      );
    }

    const eligibleVariants = exp.variants.filter((v: any) => (v.views || 0) >= minVariantViews);
    const variantsPool = eligibleVariants.length > 0
      ? eligibleVariants
      : allowLowSample
        ? exp.variants
        : [];
    if (!variantsPool.length) {
      throw new BadRequestException(
        `No variants reached minimum ${minVariantViews} views`,
      );
    }

    let bestVariant: any = null;
    let bestScore = -1;
    let bestCTR = 0;
    for (const v of variantsPool) {
      const views = v.views || 0;
      const contacts = v.contacts || 0;
      const favorites = v.favorites || 0;
      const ctr = views > 0 ? contacts / views : 0;
      const favoritesRate = views > 0 ? favorites / views : 0;
      const confidence = Math.min(views / 100, 1); // penalize tiny samples
      const score = (ctr * 0.7 + favoritesRate * 0.3) * (0.4 + confidence * 0.6);
      if (score > bestScore) {
        bestScore = score;
        bestCTR = ctr;
        bestVariant = v;
      }
    }
    if (bestVariant) {
      await this.prisma.aBExperiment.update({
        where: { id: experimentId },
        data: { winnerVariantId: bestVariant.id, status: 'winner_found' },
      });
    }
    return {
      winner: bestVariant,
      ctr: bestCTR,
      score: bestScore,
      totalViews,
      evaluatedVariants: variantsPool.length,
      minTotalViews,
      minVariantViews,
    };
  }

  async updateVariantMetrics(
    userId: string,
    experimentId: string,
    data: {
      variantId?: string;
      variantIndex?: number;
      views?: number;
      contacts?: number;
      favorites?: number;
      avitoItemId?: string;
      mode?: 'set' | 'increment';
      autoDetermineWinner?: boolean;
    },
  ) {
    const exp = await this.getExperimentById(userId, experimentId);

    const variant = data.variantId
      ? exp.variants.find((v: any) => v.id === data.variantId)
      : exp.variants.find((v: any) => v.index === data.variantIndex);
    if (!variant) {
      throw new NotFoundException('Variant not found for this experiment');
    }

    const mode = data.mode || 'set';
    const numericFields = ['views', 'contacts', 'favorites'] as const;
    for (const field of numericFields) {
      const value = data[field];
      if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
        throw new BadRequestException(`${field} must be a non-negative number`);
      }
    }

    const updateData: any = {};
    if (mode === 'increment') {
      if (data.views !== undefined) updateData.views = { increment: data.views };
      if (data.contacts !== undefined) updateData.contacts = { increment: data.contacts };
      if (data.favorites !== undefined) updateData.favorites = { increment: data.favorites };
    } else {
      if (data.views !== undefined) updateData.views = data.views;
      if (data.contacts !== undefined) updateData.contacts = data.contacts;
      if (data.favorites !== undefined) updateData.favorites = data.favorites;
    }
    if (data.avitoItemId) {
      updateData.avitoItemId = data.avitoItemId;
    }

    const updatedVariant = await this.prisma.aBVariant.update({
      where: { id: variant.id },
      data: updateData,
    });

    let winner: any = null;
    if (data.autoDetermineWinner) {
      try {
        winner = await this.determineWinner(userId, experimentId);
      } catch (error: any) {
        this.logger.log(
          `Winner not determined yet for experiment ${experimentId}: ${error.message}`,
        );
      }
    }

    return { variant: updatedVariant, winner };
  }

  async bulkUpdateVariantMetrics(
    userId: string,
    experimentId: string,
    updates: Array<{
      variantId?: string;
      variantIndex?: number;
      views?: number;
      contacts?: number;
      favorites?: number;
      avitoItemId?: string;
      mode?: 'set' | 'increment';
    }>,
  ) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new BadRequestException('updates array is required');
    }
    const results: any[] = [];
    for (const patch of updates) {
      const result = await this.updateVariantMetrics(userId, experimentId, patch);
      results.push(result.variant);
    }

    return {
      updated: results.length,
      variants: results,
    };
  }

  // ========== VARIANT ROTATION ==========

  async rotateToNextVariant(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    if (exp.status !== 'testing') throw new BadRequestException('Experiment is not in testing state');
    const nextIndex = ((exp.currentVariantIndex || 0) + 1) % exp.variants.length;
    const updated = await this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: { currentVariantIndex: nextIndex, lastRotatedAt: new Date() },
      include: { variants: true },
    });

    try {
      await this.publishVariant(userId, experimentId, nextIndex);
    } catch (error: any) {
      this.logger.warn(`Failed to queue rotated variant for experiment ${experimentId}: ${error.message}`);
    }

    return updated;
  }

  // ========== AUTO-ROTATION CRON ==========

  @Cron(CronExpression.EVERY_HOUR)
  async autoRotateExperiments() {
    const activeExperiments = await this.prisma.aBExperiment.findMany({
      where: { status: 'testing' },
      include: { variants: true },
    });
    for (const exp of activeExperiments) {
      const hoursSinceRotation = exp.lastRotatedAt
        ? (Date.now() - new Date(exp.lastRotatedAt).getTime()) / 3600000
        : exp.rotationInterval + 1;
      if (hoursSinceRotation >= exp.rotationInterval) {
        const nextIndex = ((exp.currentVariantIndex || 0) + 1) % exp.variants.length;
        await this.prisma.aBExperiment.update({
          where: { id: exp.id },
          data: { currentVariantIndex: nextIndex, lastRotatedAt: new Date() },
        });
        try {
          await this.publishVariant(exp.userId, exp.id, nextIndex);
        } catch (error: any) {
          this.logger.warn(`Failed to queue auto-rotated variant for experiment ${exp.id}: ${error.message}`);
        }
        this.logger.log(`Rotated experiment ${exp.id} to variant ${nextIndex}`);
      }
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async finalizeExpiredExperiments() {
    const now = Date.now();
    const activeExperiments = await this.prisma.aBExperiment.findMany({
      where: {
        status: 'testing',
        startedAt: { not: null },
      },
      include: { variants: true },
    });

    for (const exp of activeExperiments) {
      if (!exp.startedAt || !exp.duration) {
        continue;
      }

      const expiresAt = new Date(exp.startedAt).getTime() + exp.duration * 24 * 3600 * 1000;
      if (expiresAt > now) {
        continue;
      }

      try {
        const winnerResult = await this.determineWinner(exp.userId, exp.id, {
          allowLowSample: true,
          minTotalViews: 0,
          minVariantViews: 0,
        });

        if (winnerResult?.winner?.index !== undefined) {
          try {
            await this.publishVariant(exp.userId, exp.id, winnerResult.winner.index);
          } catch (publishError: any) {
            this.logger.warn(
              `Winner publish failed for experiment ${exp.id}: ${publishError.message}`,
            );
          }
        }

        await this.prisma.aBExperiment.update({
          where: { id: exp.id },
          data: { status: 'completed', stoppedAt: new Date() },
        });
        this.logger.log(`Finalized expired experiment ${exp.id}`);
      } catch (error: any) {
        this.logger.warn(`Finalize skipped for experiment ${exp.id}: ${error.message}`);
      }
    }
  }

  // ========== IMAGE OPTIMIZATION (AI) ==========

  async optimizeImagesWithAI(userId: string, experimentId: string, data: any) {
    const exp = await this.getExperimentById(userId, experimentId);
    const allImages: string[] = data.allImages || exp.baseImages || [];
    const numberOfVariants = data.numberOfVariants || exp.variants.length || 3;

    // Используем AI для анализа и перестановки изображений
    const analysis = await this.imageAI.analyzeImages(allImages, exp.category);
    const optimizedSets = await this.imageAI.selectAndOrderImages(allImages, exp.category, numberOfVariants);

    return {
      originalImages: allImages,
      optimizedSets,
      analysisResults: analysis,
    };
  }

  async analyzeImagesQuality(data: any) {
    const images: string[] = data.images || [];
    if (images.length === 0) throw new BadRequestException('No images provided');
    return this.imageAI.analyzeImages(images, data.category || 'general');
  }

  async updateExperimentImages(userId: string, experimentId: string, data: any) {
    const exp = await this.getExperimentById(userId, experimentId);
    const rawSets = Array.isArray(data)
      ? data
      : data?.imageSets || data?.variants || [];

    if (!Array.isArray(rawSets) || rawSets.length === 0) {
      throw new BadRequestException('No image sets provided');
    }

    const sets = rawSets
      .map((s: any, idx: number) => {
        const images = Array.isArray(s?.images)
          ? s.images
          : Array.isArray(s)
            ? s
            : [];
        return {
          index: idx,
          images: images.filter((url: any) => typeof url === 'string' && url.length > 0),
        };
      })
      .filter((s: any) => s.images.length > 0);

    if (sets.length === 0) {
      throw new BadRequestException('All image sets are empty');
    }

    const baseImages: string[] = Array.isArray(data?.allImages) && data.allImages.length > 0
      ? data.allImages
      : exp.baseImages || [];

    const existingByIndex = new Map(exp.variants.map((v: any) => [v.index, v]));

    await this.prisma.$transaction(async (tx) => {
      await tx.aBExperiment.update({
        where: { id: experimentId },
        data: { baseImages: baseImages.length ? baseImages : sets[0].images },
      });

      for (const set of sets) {
        const existing = existingByIndex.get(set.index);
        if (existing) {
          await tx.aBVariant.update({
            where: { id: existing.id },
            data: { images: set.images },
          });
        } else {
          await tx.aBVariant.create({
            data: {
              experimentId,
              name: `Variant ${set.index + 1}`,
              index: set.index,
              title: exp.baseTitle,
              description: exp.baseDescription,
              price: exp.basePrice,
              images: set.images,
            },
          });
        }
      }
    });

    return this.getExperimentById(userId, experimentId);
  }

  async getExperimentWithStats(userId: string, experimentId: string, dateFrom?: string, dateTo?: string) {
    const stats = await this.getExperimentStats(userId, experimentId);
    return stats;
  }

  async getBestImageCombinations(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    const ranked = [...exp.variants]
      .map((v: any) => {
        const views = v.views || 0;
        const contacts = v.contacts || 0;
        const favorites = v.favorites || 0;
        const ctr = views > 0 ? contacts / views : 0;
        const favoritesRate = views > 0 ? favorites / views : 0;
        const score = ctr * 0.7 + favoritesRate * 0.3;
        return {
          variantId: v.id,
          variantIndex: v.index,
          name: v.name,
          images: v.images || [],
          views,
          contacts,
          favorites,
          ctr: Number((ctr * 100).toFixed(2)),
          favoritesRate: Number((favoritesRate * 100).toFixed(2)),
          score: Number((score * 100).toFixed(2)),
        };
      })
      .sort((a, b) => b.score - a.score);

    return ranked.slice(0, 5);
  }

  async publishVariant(userId: string, experimentId: string, variantIndex?: number) {
    const exp = await this.getExperimentById(userId, experimentId);
    if (!exp.projectId) {
      throw new BadRequestException('Experiment projectId is required for publication');
    }
    await this.assertProjectAccess(userId, exp.projectId);

    const resolvedIndex = Number.isInteger(variantIndex)
      ? Number(variantIndex)
      : Number(exp.currentVariantIndex || 0);

    const variant = exp.variants.find((v: any) => v.index === resolvedIndex);
    if (!variant) {
      throw new NotFoundException(`Variant with index ${resolvedIndex} not found`);
    }

    let category = await this.prisma.autoloadCategory.findFirst({
      where: {
        OR: [
          { id: exp.category },
          { slug: exp.category },
          { nameRu: exp.category },
        ],
      },
      select: { id: true },
    });

    if (!category) {
      category = await this.prisma.autoloadCategory.findFirst({
        where: { isActive: true },
        select: { id: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!category) {
      throw new BadRequestException('No autoload category found. Sync categories first');
    }

    const project = exp.projectId
      ? await this.prisma.project.findUnique({
          where: { id: exp.projectId },
          select: { ownerId: true },
        })
      : null;
    const ownerProfileId = await this.resolveOwnerProfileId(project?.ownerId || exp.userId);

    const account = await this.prisma.avitoAccount.findFirst({
      where: { user_id: ownerProfileId, is_active: true },
      select: { id: true },
      orderBy: { created_at: 'desc' },
    });

    const externalId = `ab-${experimentId}-v${resolvedIndex}`;
    const price = Math.max(0, Math.round(variant.price || 0));

    const item = await this.prisma.autoloadItem.upsert({
      where: {
        projectId_externalId: { projectId: exp.projectId, externalId },
      },
      update: {
        accountId: account?.id || undefined,
        categoryId: category.id,
        title: variant.title,
        description: variant.description,
        price,
        imageUrls: variant.images || [],
        status: 'draft',
        isActive: true,
      },
      create: {
        projectId: exp.projectId,
        accountId: account?.id || undefined,
        categoryId: category.id,
        externalId,
        title: variant.title,
        description: variant.description,
        price,
        imageUrls: variant.images || [],
        status: 'draft',
        isActive: true,
      },
    });

    await this.prisma.aBVariant.update({
      where: { id: variant.id },
      data: { publishedAt: new Date(), avitoItemId: item.avitoId || variant.avitoItemId },
    });

    await this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: { currentVariantIndex: resolvedIndex, currentAvitoItemId: item.avitoId || null },
    });

    await this.prisma.systemEventLog.create({
      data: {
        event: 'ab_variant_queued',
        level: 'info',
        module: 'ab_tester',
        message: `Variant ${resolvedIndex} queued for publication`,
        userId,
        projectId: exp.projectId,
        data: {
          experimentId,
          variantId: variant.id,
          variantIndex: resolvedIndex,
          autoloadItemId: item.id,
          externalId,
        },
      },
    });

    return {
      published: true,
      queued: true,
      experimentId,
      variantId: variant.id,
      variantIndex: resolvedIndex,
      autoloadItemId: item.id,
      externalId,
    };
  }

}
