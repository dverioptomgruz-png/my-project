import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export enum BidderStrategyEnum {
  HOLD_POSITION = 'HOLD_POSITION',
  MIN_BID = 'MIN_BID',
  MAX_COVERAGE = 'MAX_COVERAGE',
  SCHEDULE_BASED = 'SCHEDULE_BASED',
}

export class CreateBidderRuleDto {
  @ApiProperty({ example: 'Main bidding rule' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'clu1abc...' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ enum: BidderStrategyEnum, example: BidderStrategyEnum.HOLD_POSITION })
  @IsEnum(BidderStrategyEnum)
  strategy: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0)
  minBid: number;

  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(0)
  maxBid: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyBudget?: number;

  @ApiPropertyOptional({
    example: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 22 },
  })
  @IsOptional()
  @IsObject()
  schedule?: Record<string, any>;

  @ApiPropertyOptional({
    example: { categories: ['electronics'], priceMin: 0, priceMax: 100000 },
  })
  @IsOptional()
  @IsObject()
  itemFilter?: Record<string, any>;
}

export class UpdateBidderRuleDto extends PartialType(CreateBidderRuleDto) {}
