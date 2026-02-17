import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ABTesterController } from './ab-tester.controller';
import { ABTesterService } from './ab-tester.service';
import { YandexDiskService } from './yandex-disk.service';
import { ImageAIService } from './image-ai.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AvitoModule } from '../avito/avito.module';

@Module({
  imports: [PrismaModule, AvitoModule, ConfigModule],
  controllers: [ABTesterController],
  providers: [ABTesterService, YandexDiskService, ImageAIService],
  exports: [ABTesterService, YandexDiskService, ImageAIService],
})
export class ABTesterModule {}
