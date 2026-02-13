import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('daily')
  @ApiOperation({ summary: 'Get daily analytics stats for a project within a date range' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'from', required: true, type: String, description: 'Start date (ISO format)' })
  @ApiQuery({ name: 'to', required: true, type: String, description: 'End date (ISO format)' })
  getDailyStats(
    @Query('projectId') projectId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.analyticsService.getDailyStats(projectId, from, to);
  }

  @Post('daily')
  @ApiOperation({ summary: 'Upsert daily analytics data for a project' })
  upsertDaily(
    @Body()
    body: {
      projectId: string;
      date: string;
      views?: number;
      favorites?: number;
      contacts?: number;
      chats?: number;
      calls?: number;
      spend?: number;
      cpl?: number;
      roi?: number;
      romi?: number;
    },
  ) {
    return this.analyticsService.upsertDaily(body);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export daily analytics as CSV file' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'from', required: true, type: String })
  @ApiQuery({ name: 'to', required: true, type: String })
  async exportCsv(
    @Query('projectId') projectId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const csv = await this.analyticsService.exportCsv(projectId, from, to);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="analytics_${projectId}_${from}_${to}.csv"`,
    );
    res.send(csv);
  }
}
