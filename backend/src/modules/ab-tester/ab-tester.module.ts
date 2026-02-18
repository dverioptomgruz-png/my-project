import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ABTesterController } from './ab-tester.controller';
import { ABTesterService } from './ab-tester.service';
import { YandexDiskService } from './yandex-disk.service';
import { ImageAIService } from './image-ai.service';
import { CRMConnectorService } from './crm-connector.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AvitoModule } from '../avito/avito.module';

@Module({
  imports: [PrismaModule, AvitoModule, ConfigModule],
  controllers: [ABTesterController],
  providers: [ABTesterService, YandexDiskService, ImageAIService, CRMConnectorService],
  exports: [ABTesterService, YandexDiskService, ImageAIService, CRMConnectorService],
})
export class ABTesterModule {}
