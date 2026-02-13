import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AutoloadService } from './autoload.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Autoload')
@ApiBearerAuth()
@Controller('autoload')
export class AutoloadController {
  constructor(private readonly autoloadService: AutoloadService) {}

  @Get('reports')
  @ApiOperation({ summary: 'List autoload reports for a project with pagination' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getReports(
    @Query('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.autoloadService.getReports(
      projectId,
      parseInt(skip || '0', 10),
      parseInt(take || '50', 10),
    );
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single autoload report by ID' })
  getReport(@Param('id') id: string) {
    return this.autoloadService.getReport(id);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Create an autoload report (used by n8n webhook)' })
  createReport(
    @Body()
    body: {
      projectId: string;
      total: number;
      ok: number;
      failed: number;
      rawJson?: any;
    },
  ) {
    return this.autoloadService.createReport(body);
  }
}
