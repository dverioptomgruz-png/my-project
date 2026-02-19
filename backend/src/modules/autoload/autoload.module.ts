import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { AutoloadService } from './autoload.service';
import {
  AutoloadController,
  AutoloadInternalController,
  AutoloadWebhookController,
} from './autoload.controller';

@Module({
  imports: [ScheduleModule.forRoot(), ConfigModule],
  controllers: [
    AutoloadController,
    AutoloadInternalController,
    AutoloadWebhookController,
  ],
  providers: [AutoloadService],
  exports: [AutoloadService],
})
export class AutoloadModule {}
