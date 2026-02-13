import { Module } from '@nestjs/common';
import { AutoloadService } from './autoload.service';
import { AutoloadController } from './autoload.controller';

@Module({
  controllers: [AutoloadController],
  providers: [AutoloadService],
  exports: [AutoloadService],
})
export class AutoloadModule {}
