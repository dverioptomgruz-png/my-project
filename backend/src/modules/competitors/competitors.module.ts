import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CompetitorsService } from './competitors.service';
import { CompetitorsController } from './competitors.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CompetitorsController],
  providers: [CompetitorsService],
  exports: [CompetitorsService],
})
export class CompetitorsModule {}
