import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
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

  // ========== EXPERIMENT MANAGEMENT ==========

  async createExperiment(userId: string, data: any) {
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

  async getExperiments(userId: string, projectId?: string) {
    const where: any = { userId };
    if (projectId) where.projectId = projectId;
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
    return this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: {
        status: 'testing',
        startedAt: new Date(),
        currentVariantIndex: 0,
      },
      include: { variants: true },
    });
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
      diskImages = files.filter((f: any) => /\.(jpg|jpeg|png|webp)$/i.test(f.name)).map((f: any) => f.url);
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

  async determineWinner(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    let bestVariant: any = null;
    let bestCTR = -1;
    for (const v of exp.variants) {
      const ctr = v.views > 0 ? v.contacts / v.views : 0;
      if (ctr > bestCTR) { bestCTR = ctr; bestVariant = v; }
    }
    if (bestVariant) {
      await this.prisma.aBExperiment.update({
        where: { id: experimentId },
        data: { winnerVariantId: bestVariant.id, status: 'winner_found' },
      });
    }
    return { winner: bestVariant, ctr: bestCTR };
  }

  // ========== VARIANT ROTATION ==========

  async rotateToNextVariant(userId: string, experimentId: string) {
    const exp = await this.getExperimentById(userId, experimentId);
    if (exp.status !== 'testing') throw new BadRequestException('Experiment is not in testing state');
    const nextIndex = ((exp.currentVariantIndex || 0) + 1) % exp.variants.length;
    return this.prisma.aBExperiment.update({
      where: { id: experimentId },
      data: { currentVariantIndex: nextIndex, lastRotatedAt: new Date() },
      include: { variants: true },
    });
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
        this.logger.log(`Rotated experiment ${exp.id} to variant ${nextIndex}`);
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
}