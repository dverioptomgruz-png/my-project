import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SystemService } from './system.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('System')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Check system health (database connectivity)' })
  getHealth() {
    return this.systemService.getHealth();
  }

  @Get('events')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List system event logs with optional filtering' })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  @ApiQuery({ name: 'level', required: false, type: String, enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'] })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getEvents(
    @Query('projectId') projectId?: string,
    @Query('level') level?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.systemService.getEvents(
      projectId,
      level,
      parseInt(skip || '0', 10),
      parseInt(take || '100', 10),
    );
  }

  @Get('services')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Ping external services (n8n, SearXNG) and report their status' })
  getServiceStatuses() {
    return this.systemService.getServiceStatuses();
  }
}
