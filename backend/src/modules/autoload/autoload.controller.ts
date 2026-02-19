import {
  Controller, Get, Post, Param, Body, Query, Headers,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiHeader,
} from '@nestjs/swagger';
import { AutoloadService } from './autoload.service';
import { ConfigService } from '@nestjs/config';

// =============================================
// PUBLIC API CONTROLLER (requires Bearer auth)
// =============================================

@ApiTags('Autoload')
@ApiBearerAuth()
@Controller('autoload')
export class AutoloadController {
  constructor(private readonly svc: AutoloadService) {}

  // --- Local DB Reports ---

  @Get('reports')
  @ApiOperation({ summary: 'List autoload reports for a project' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getReports(
    @Query('projectId') projectId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.svc.getReports(projectId, parseInt(skip || '0', 10), parseInt(take || '50', 10));
  }

  @Get('reports/:id')
  @ApiOperation({ summary: 'Get a single autoload report by ID' })
  getReport(@Param('id') id: string) {
    return this.svc.getReport(id);
  }

  @Post('reports')
  @ApiOperation({ summary: 'Create an autoload report (n8n webhook)' })
  createReport(@Body() body: {
    projectId: string; accountId?: string;
    total: number; ok: number; failed: number;
    status?: string; source?: string; rawJson?: any;
  }) {
    return this.svc.createReport(body);
  }

  // --- Autoload Runs ---

  @Get('runs')
  @ApiOperation({ summary: 'List autoload runs' })
  @ApiQuery({ name: 'accountId', required: false, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getRuns(
    @Query('accountId') accountId?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.svc.getAutoloadRuns(accountId, parseInt(skip || '0', 10), parseInt(take || '50', 10));
  }

  // --- Avito Autoload Profile ---

  @Get('profile/:accountId')
  @ApiOperation({ summary: 'Get autoload profile from Avito API' })
  getProfile(@Param('accountId') accountId: string) {
    return this.svc.getAutoloadProfile(accountId);
  }

  @Post('profile/:accountId')
  @ApiOperation({ summary: 'Create/update autoload profile on Avito' })
  updateProfile(@Param('accountId') accountId: string, @Body() body: any) {
    return this.svc.updateAutoloadProfile(accountId, body);
  }

  // --- Trigger Upload ---

  @Post('upload/:accountId')
  @ApiOperation({ summary: 'Trigger autoload upload on Avito (max 1/hour)' })
  triggerUpload(@Param('accountId') accountId: string) {
    return this.svc.triggerUpload(accountId);
  }

  // --- Avito Reports ---

  @Get('avito-reports/:accountId')
  @ApiOperation({ summary: 'Get autoload reports from Avito API' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'per_page', required: false, type: Number })
  getAvitoReports(
    @Param('accountId') accountId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.svc.getAvitoReports(accountId, parseInt(page || '0', 10), parseInt(perPage || '50', 10));
  }

  @Get('avito-reports/:accountId/:reportId')
  @ApiOperation({ summary: 'Get specific Avito report by ID' })
  getAvitoReport(
    @Param('accountId') accountId: string,
    @Param('reportId') reportId: string,
  ) {
    return this.svc.getAvitoReportById(accountId, parseInt(reportId, 10));
  }

  @Get('avito-reports/:accountId/last')
  @ApiOperation({ summary: 'Get last completed Avito report' })
  getLastReport(@Param('accountId') accountId: string) {
    return this.svc.getLastCompletedReport(accountId);
  }

  @Get('avito-reports/:accountId/:reportId/items')
  @ApiOperation({ summary: 'Get items from specific Avito report' })
  getReportItems(
    @Param('accountId') accountId: string,
    @Param('reportId') reportId: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    return this.svc.getReportItems(accountId, parseInt(reportId, 10), parseInt(page || '0', 10), parseInt(perPage || '50', 10));
  }

  // --- Items Info & ID Mapping ---

  @Get('items-info/:accountId')
  @ApiOperation({ summary: 'Get autoload items info by IDs' })
  @ApiQuery({ name: 'query', required: true, type: String })
  getItemsInfo(@Param('accountId') accountId: string, @Query('query') query: string) {
    return this.svc.getItemsInfo(accountId, query);
  }

  @Get('ad-ids/:accountId')
  @ApiOperation({ summary: 'Get ad IDs by Avito IDs' })
  @ApiQuery({ name: 'query', required: true, type: String })
  getAdIds(@Param('accountId') accountId: string, @Query('query') query: string) {
    return this.svc.getAdIdsByAvitoIds(accountId, query);
  }

  @Get('avito-ids/:accountId')
  @ApiOperation({ summary: 'Get Avito IDs by ad IDs' })
  @ApiQuery({ name: 'query', required: true, type: String })
  getAvitoIds(@Param('accountId') accountId: string, @Query('query') query: string) {
    return this.svc.getAvitoIdsByAdIds(accountId, query);
  }

  // --- Category Tree ---

  @Get('categories/tree')
  @ApiOperation({ summary: 'Get Avito category tree' })
  getCategoryTree() {
    return this.svc.getCategoryTree();
  }

  @Get('categories/:slug/fields')
  @ApiOperation({ summary: 'Get fields for a category' })
  getCategoryFields(@Param('slug') slug: string) {
    return this.svc.getCategoryFields(slug);
  }
}

// =============================================
// INTERNAL CONTROLLER (n8n service-to-service)
// =============================================

@ApiTags('Internal - Autoload')
@Controller('internal')
export class AutoloadInternalController {
  constructor(
    private readonly svc: AutoloadService,
    private readonly configService: ConfigService,
  ) {}

  private validateServiceToken(token: string) {
    const expected = this.configService.get('N8N_SERVICE_TOKEN');
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid service token');
    }
  }

  @Get('projects/:projectId/items')
  @ApiOperation({ summary: 'Get items for autoload (n8n)' })
  @ApiHeader({ name: 'x-service-token', required: true })
  getItemsForAutoload(
    @Param('projectId') projectId: string,
    @Headers('x-service-token') token: string,
  ) {
    this.validateServiceToken(token);
    return this.svc.getItemsForAutoload(projectId);
  }

  @Get('accounts/:accountId/token')
  @ApiOperation({ summary: 'Get valid Avito token for account (n8n)' })
  @ApiHeader({ name: 'x-service-token', required: true })
  getToken(
    @Param('accountId') accountId: string,
    @Headers('x-service-token') token: string,
  ) {
    this.validateServiceToken(token);
    return this.svc.getTokenForAccount(accountId);
  }
}

// =============================================
// AUTOLOAD-RUNS + N8N LOGS CONTROLLER
// =============================================

@ApiTags('Internal - N8N')
@Controller()
export class AutoloadWebhookController {
  constructor(
    private readonly svc: AutoloadService,
    private readonly configService: ConfigService,
  ) {}

  private validateServiceToken(token: string) {
    const expected = this.configService.get('N8N_SERVICE_TOKEN');
    if (!expected || token !== expected) {
      throw new UnauthorizedException('Invalid service token');
    }
  }

  @Post('autoload-runs')
  @ApiOperation({ summary: 'Save autoload run result from n8n' })
  @ApiHeader({ name: 'x-service-token', required: true })
  saveRun(
    @Body() body: any,
    @Headers('x-service-token') token: string,
  ) {
    this.validateServiceToken(token);
    return this.svc.saveAutoloadRun(body);
  }

  @Post('n8n/logs')
  @ApiOperation({ summary: 'Save n8n log entry' })
  @ApiHeader({ name: 'x-service-token', required: true })
  saveLog(
    @Body() body: any,
    @Headers('x-service-token') token: string,
  ) {
    this.validateServiceToken(token);
    return this.svc.saveN8nLog(body);
  }
}
