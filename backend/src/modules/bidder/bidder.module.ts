import { Module } from '@nestjs/common';
import { BidderService } from './bidder.service';
import { BidderController } from './bidder.controller';

@Module({
  controllers: [BidderController],
  providers: [BidderService],
  exports: [BidderService],
})
export class BidderModule {}
