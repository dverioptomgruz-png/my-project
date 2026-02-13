import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AvitoService } from './avito.service';
import { AvitoController } from './avito.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AvitoController],
  providers: [AvitoService],
  exports: [AvitoService],
})
export class AvitoModule {}
