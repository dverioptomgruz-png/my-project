import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AvitoService } from './avito.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Avito')
@Controller('avito')
export class AvitoController {
  constructor(private readonly avitoService: AvitoService) {}

  // ── Public OAuth endpoints (no JWT required) ─────────

  @Public()
  @Get('oauth/start')
  @ApiOperation({
    summary: 'Start Avito OAuth flow — redirects the user to Avito authorization page',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  oauthStart(
    @Query('projectId') projectId: string,
    @Res() res: Response,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }

    const authUrl = this.avitoService.getAuthUrl(projectId);
    return res.redirect(authUrl);
  }

  @Public()
  @Get('oauth/callback')
  @ApiOperation({
    summary: 'Avito OAuth callback — exchanges code for tokens and redirects to frontend',
  })
  @ApiQuery({ name: 'code', required: true, type: String })
  @ApiQuery({ name: 'state', required: true, type: String })
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    if (!code || !state) {
      throw new BadRequestException(
        'Both "code" and "state" query parameters are required',
      );
    }

    const projectId = await this.avitoService.handleCallback(code, state);

    // Redirect the user back to the frontend project page
    const frontendUrl = `http://localhost:3000/app/projects/${projectId}/avito?connected=true`;
    return res.redirect(frontendUrl);
  }

  // ── Protected endpoints (JWT required) ───────────────

  @Post('refresh')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Avito tokens for a connected account' })
  async refreshToken(@Body('accountId') accountId: string) {
    if (!accountId) {
      throw new BadRequestException('accountId is required in request body');
    }

    return this.avitoService.refreshToken(accountId);
  }

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Avito account connection status for a project (no tokens exposed)',
  })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  async getStatus(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new BadRequestException('projectId query parameter is required');
    }

    return this.avitoService.getStatus(projectId);
  }
}
