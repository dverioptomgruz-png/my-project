import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { N8nService } from './n8n.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('N8N')
@Controller('n8n')
export class N8nController {
  constructor(
    private readonly n8nService: N8nService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validate the X-N8N-API-Key header against the N8N_API_KEY env var.
   * All n8n endpoints are @Public() (no JWT) but require this API key.
   */
  private validateApiKey(apiKey: string | undefined): void {
    const expectedKey = this.config.get<string>('N8N_API_KEY');
    if (!expectedKey) {
      throw new UnauthorizedException(
        'N8N_API_KEY is not configured on the server',
      );
    }
    if (!apiKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing X-N8N-API-Key header');
    }
  }

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Get active rules, account statuses, and recent events for n8n workflows' })
  @ApiHeader({ name: 'X-N8N-API-Key', required: true })
  @ApiQuery({ name: 'projectId', required: false, type: String })
  getConfig(
    @Headers('x-n8n-api-key') apiKey: string,
    @Query('projectId') projectId?: string,
  ) {
    this.validateApiKey(apiKey);
    return this.n8nService.getConfig(projectId);
  }

  @Public()
  @Post('log')
  @ApiOperation({ summary: 'Log an n8n workflow execution' })
  @ApiHeader({ name: 'X-N8N-API-Key', required: true })
  logExecution(
    @Headers('x-n8n-api-key') apiKey: string,
    @Body()
    body: {
      module: string;
      projectId: string;
      payload: any;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.n8nService.logExecution(body);
  }

  @Public()
  @Post('status')
  @ApiOperation({ summary: 'Update n8n workflow status' })
  @ApiHeader({ name: 'X-N8N-API-Key', required: true })
  updateStatus(
    @Headers('x-n8n-api-key') apiKey: string,
    @Body()
    body: {
      module: string;
      projectId: string;
      status: string;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.n8nService.updateStatus(body);
  }

  @Public()
  @Post('alert')
  @ApiOperation({ summary: 'Create an alert from n8n workflow' })
  @ApiHeader({ name: 'X-N8N-API-Key', required: true })
  createAlert(
    @Headers('x-n8n-api-key') apiKey: string,
    @Body()
    body: {
      projectId: string;
      level: string;
      module: string;
      message: string;
    },
  ) {
    this.validateApiKey(apiKey);
    return this.n8nService.createAlert(body);
  }
}
