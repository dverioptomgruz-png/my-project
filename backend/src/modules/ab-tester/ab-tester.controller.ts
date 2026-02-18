import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ABTesterService } from './ab-tester.service';
import { YandexDiskService } from './yandex-disk.service';
import { ImageAIService } from './image-ai.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Avito image limits by category/tariff
const AVITO_IMAGE_LIMITS = {
  default: 10,
  transport: 40,
  realty: 40,
  extended_tariff: 30,
};

@ApiTags('A/B Tester')
@Controller('ab-tester')
export class ABTesterController {
  constructor(
    private readonly abTesterService: ABTesterService,
    private readonly yandexDiskService: YandexDiskService,
    private readonly imageAIService: ImageAIService,
  ) {}

  // ========= EXPERIMENTS =========

  @Post('experiments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create A/B experiment' })
  async createExperiment(@CurrentUser() user: any, @Body() data: any) {
    return this.abTesterService.createExperiment(user.id, data);
  }

  @Get('experiments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List experiments' })
  async getExperiments(
    @CurrentUser() user: any,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.abTesterService.getExperiments(user.id, projectId, status);
  }

  @Get('experiments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get experiment details' })
  async getExperiment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.getExperimentWithStats(user.id, id);
  }

  @Put('experiments/:id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start experiment' })
  async startExperiment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.startExperiment(user.id, id);
  }

  @Put('experiments/:id/stop')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stop experiment' })
  async stopExperiment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.stopExperiment(user.id, id);
  }

  @Delete('experiments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete experiment' })
  async deleteExperiment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.deleteExperiment(user.id, id);
  }

  // ========= AI HYPOTHESIS GENERATION =========

  @Post('generate-hypotheses')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI generates variants for testing' })
  async generateHypotheses(@CurrentUser() user: any, @Body() data: any) {
    return this.abTesterService.generateHypotheses(data);
  }

  // ========= YANDEX.DISK IMAGE SOURCE =========

  @Post('images/from-yandex-disk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Import images from Yandex.Disk public folder, AI selects best 10',
  })
  async importFromYandexDisk(
    @CurrentUser() user: any,
    @Body() data: {
      yandexDiskUrl: string;  // Public share link
      experimentId: string;
      category: string;
      maxSlots?: number;      // 10 (default), 30 or 40
    },
  ) {
    // 1. Fetch all image URLs from Yandex.Disk folder
    const allImageUrls = await this.yandexDiskService.getFilesFromPublicFolder(
      data.yandexDiskUrl,
    );

    if (allImageUrls.length === 0) {
      return { error: 'No images found in Yandex.Disk folder' };
    }

    // 2. Determine max slots based on category/tariff
    const maxSlots = data.maxSlots ||
      AVITO_IMAGE_LIMITS[data.category] ||
      AVITO_IMAGE_LIMITS.default;

    // 3. GPT-4 Vision analyzes ALL images and selects best ones
    const imageSets = await this.imageAIService.selectAndOrderImages(
      allImageUrls,
      data.category,
      maxSlots,
    );

    // 4. Update experiment with AI-selected image variants
    await this.abTesterService.updateExperimentImages(
      user.id,
      data.experimentId,
      imageSets,
    );

    return {
      message: 'Images imported from Yandex.Disk',
      totalFoundOnDisk: allImageUrls.length,
      slotsUsed: Math.min(allImageUrls.length, maxSlots),
      maxSlots,
      variants: imageSets.map((s) => ({
        reasoning: s.reasoning,
        imageCount: s.images.length,
        mainImage: s.images[0],
        predictedCTR: s.predictedCTR,
      })),
    };
  }

  // ========= AI IMAGE ANALYSIS =========

  @Post('images/analyze')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'GPT-4 Vision analyzes image quality for Avito' })
  async analyzeImages(
    @CurrentUser() user: any,
    @Body() data: { images: string[]; category: string },
  ) {
    return this.imageAIService.analyzeImages(data.images, data.category);
  }

  @Post('images/select-best')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'AI selects best images and fills all slots (min 10)',
  })
  async selectBestImages(
    @CurrentUser() user: any,
    @Body() data: {
      images: string[];
      category: string;
      maxSlots?: number;
    },
  ) {
    const maxSlots = data.maxSlots || AVITO_IMAGE_LIMITS.default;
    return this.imageAIService.selectAndOrderImages(
      data.images,
      data.category,
      maxSlots,
    );
  }

  // ========= STATS =========

  @Get('experiments/:id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get experiment statistics' })
  async getExperimentStats(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.abTesterService.getExperimentWithStats(user.id, id, dateFrom, dateTo);
  }

  @Get('experiments/:id/winner')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Determine winning variant' })
  async getWinningVariant(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.determineWinner(user.id, id);
  }

  @Get('experiments/:id/best-images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Best performing image combinations' })
  async getBestImageCombinations(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.abTesterService.getBestImageCombinations(user.id, id);
  }

  // ========= AUTOLOAD INTEGRATION =========

  @Post('experiments/:id/publish')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish variant to Avito via Autoload' })
  async publishVariant(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() data: { variantIndex: number },
  ) {
    return this.abTesterService.publishVariant(user.id, id, data.variantIndex);
  }

  @Post('experiments/:id/rotate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rotate to next variant' })
  async rotateVariant(@CurrentUser() user: any, @Param('id') id: string) {
    return this.abTesterService.rotateToNextVariant(user.id, id);
  }

  // ========= IMAGE LIMITS INFO =========

  @Get('image-limits')
  @ApiOperation({ summary: 'Get Avito image slot limits by category' })
  async getImageLimits() {
    return {
      limits: AVITO_IMAGE_LIMITS,
      requirements: {
        format: ['jpg', 'jpeg', 'png', 'gif'],
        maxFileSize: '25 MB',
        minResolution: '1600x1200',
        optimalResolution: '1920x1440',
        minSlots: 10,
        note: 'First image = main photo shown in search results',
      },
    };
  }
}
