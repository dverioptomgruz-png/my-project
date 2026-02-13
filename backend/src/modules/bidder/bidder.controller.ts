import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { BidderService } from './bidder.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateBidderRuleDto, UpdateBidderRuleDto } from './dto/bidder.dto';

@ApiTags('Bidder')
@ApiBearerAuth()
@Controller('bidder')
export class BidderController {
  constructor(private readonly bidderService: BidderService) {}

  @Post('rules')
  @ApiOperation({ summary: 'Create a new bidder rule' })
  create(@Body() dto: CreateBidderRuleDto) {
    return this.bidderService.create(dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'List all bidder rules for a project' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  findAll(@Query('projectId') projectId: string) {
    return this.bidderService.findAll(projectId);
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get a single bidder rule by ID' })
  findOne(@Param('id') id: string) {
    return this.bidderService.findOne(id);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update a bidder rule' })
  update(@Param('id') id: string, @Body() dto: UpdateBidderRuleDto) {
    return this.bidderService.update(id, dto);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete a bidder rule' })
  delete(@Param('id') id: string) {
    return this.bidderService.delete(id);
  }

  @Patch('rules/:id/toggle')
  @ApiOperation({ summary: 'Toggle enabled/disabled state of a bidder rule' })
  toggle(@Param('id') id: string) {
    return this.bidderService.toggle(id);
  }

  @Get('logs/:ruleId')
  @ApiOperation({ summary: 'List execution logs for a bidder rule' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getLogs(
    @Param('ruleId') ruleId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.bidderService.getLogs(
      ruleId,
      parseInt(skip || '0', 10),
      parseInt(take || '50', 10),
    );
  }
}
