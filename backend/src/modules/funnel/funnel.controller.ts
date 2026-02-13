import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FunnelService } from './funnel.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Funnel')
@ApiBearerAuth()
@Controller('funnel')
export class FunnelController {
  constructor(private readonly funnelService: FunnelService) {}

  @Get('data')
  @ApiOperation({ summary: 'Get funnel data aggregated from analytics for a date range' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'End date (ISO format)' })
  getFunnelData(
    @Query('projectId') projectId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.funnelService.getFunnelData(projectId, from, to);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate ROI, ROMI, and CPL from revenue, spend, and leads' })
  calculateRoi(
    @Body()
    body: {
      revenue: number;
      spend: number;
      leads: number;
    },
  ) {
    return this.funnelService.calculateRoi(body);
  }
}
