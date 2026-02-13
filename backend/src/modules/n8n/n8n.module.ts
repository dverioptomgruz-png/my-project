import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { N8nService } from './n8n.service';
import { N8nController } from './n8n.controller';

@Module({
  imports: [ConfigModule],
  controllers: [N8nController],
  providers: [N8nService],
  exports: [N8nService],
})
export class N8nModule {}
