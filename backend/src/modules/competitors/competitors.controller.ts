import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CompetitorsService } from './competitors.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Competitors')
@ApiBearerAuth()
@Controller('competitors')
export class CompetitorsController {
  constructor(private readonly competitorsService: CompetitorsService) {}

  @Get('snapshots')
  @ApiOperation({ summary: 'List competitor snapshots for a project' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getSnapshots(
    @Query('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.competitorsService.getSnapshots(
      projectId,
      parseInt(skip || '0', 10),
      parseInt(take || '50', 10),
    );
  }

  @Post('snapshots')
  @ApiOperation({ summary: 'Create a competitor snapshot manually' })
  createSnapshot(
    @Body()
    body: {
      projectId: string;
      query: string;
      resultsJson?: any;
    },
  ) {
    return this.competitorsService.createSnapshot(body);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search competitors via SearXNG and save snapshot' })
  search(
    @Body()
    body: {
      projectId: string;
      query: string;
    },
  ) {
    return this.competitorsService.search(body.projectId, body.query);
  }
}
