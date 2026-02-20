import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AutoloadService } from './autoload.service';
import {
  CreateAutoloadFeedDto,
  UpdateAutoloadFeedDto,
  CreateAutoloadItemDto,
  UpdateAutoloadItemDto,
  SetItemBidDto,
  CreateScheduleSlotDto,
  UpdateScheduleSlotDto,
  BulkSetBidsDto,
} from './dto/autoload.dto';

@ApiTags('Autoload')
@ApiBearerAuth()
@Controller('autoload')
export class AutoloadController {
  constructor(private readonly autoloadService: AutoloadService) {}

  // ===== Reports =====

  @Get('reports')
  @ApiOperation({ summary: 'List autoload reports with pagination' })
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
  @ApiOperation({ summary: 'Create an autoload report (n8n webhook)' })
  createReport(
    @Body() body: {
      projectId: string;
      total: number;
      ok: number;
      failed: number;
      rawJson?: any;
    },
  ) {
    return this.autoloadService.createReport(body);
  }

  // ===== Feeds =====

  @Post('feeds')
  @ApiOperation({ summary: 'Create a new autoload feed' })
  createFeed(@Body() dto: CreateAutoloadFeedDto) {
    return this.autoloadService.createFeed(dto);
  }

  @Get('feeds')
  @ApiOperation({ summary: 'List all feeds for a project' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  getFeeds(@Query('projectId') projectId: string) {
    return this.autoloadService.getFeeds(projectId);
  }

  @Get('feeds/:id')
  @ApiOperation({ summary: 'Get feed with items and schedules' })
  getFeed(@Param('id') id: string) {
    return this.autoloadService.getFeed(id);
  }

  @Patch('feeds/:id')
  @ApiOperation({ summary: 'Update a feed' })
  updateFeed(@Param('id') id: string, @Body() dto: UpdateAutoloadFeedDto) {
    return this.autoloadService.updateFeed(id, dto);
  }

  @Delete('feeds/:id')
  @ApiOperation({ summary: 'Delete a feed and all its items/schedules' })
  deleteFeed(@Param('id') id: string) {
    return this.autoloadService.deleteFeed(id);
  }

  // ===== Items =====

  @Post('items')
  @ApiOperation({ summary: 'Create a new autoload item' })
  createItem(@Body() dto: CreateAutoloadItemDto) {
    return this.autoloadService.createItem(dto);
  }

  @Get('items')
  @ApiOperation({ summary: 'List items for a feed with pagination' })
  @ApiQuery({ name: 'feedId', required: true, type: String })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  getItems(
    @Query('feedId') feedId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.autoloadService.getItems(
      feedId,
      parseInt(skip || '0', 10),
      parseInt(take || '50', 10),
    );
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get a single item by ID' })
  getItem(@Param('id') id: string) {
    return this.autoloadService.getItem(id);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Update an item' })
  updateItem(@Param('id') id: string, @Body() dto: UpdateAutoloadItemDto) {
    return this.autoloadService.updateItem(id, dto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete an item' })
  deleteItem(@Param('id') id: string) {
    return this.autoloadService.deleteItem(id);
  }

  // ===== Bids =====

  @Put('items/:id/bid')
  @ApiOperation({ summary: 'Set bid for a single item (with city bids)' })
  setItemBid(@Param('id') id: string, @Body() dto: SetItemBidDto) {
    return this.autoloadService.setItemBid(id, dto);
  }

  @Post('items/bulk-bids')
  @ApiOperation({ summary: 'Set bids for multiple items at once' })
  bulkSetBids(@Body() dto: BulkSetBidsDto) {
    return this.autoloadService.bulkSetBids(dto);
  }

  // ===== Schedule Slots =====

  @Post('schedules')
  @ApiOperation({ summary: 'Create a schedule slot for a feed' })
  createScheduleSlot(@Body() dto: CreateScheduleSlotDto) {
    return this.autoloadService.createScheduleSlot(dto);
  }

  @Get('schedules')
  @ApiOperation({ summary: 'List schedule slots for a feed' })
  @ApiQuery({ name: 'feedId', required: true, type: String })
  getScheduleSlots(@Query('feedId') feedId: string) {
    return this.autoloadService.getScheduleSlots(feedId);
  }

  @Patch('schedules/:id')
  @ApiOperation({ summary: 'Update a schedule slot' })
  updateScheduleSlot(@Param('id') id: string, @Body() dto: UpdateScheduleSlotDto) {
    return this.autoloadService.updateScheduleSlot(id, dto);
  }

  @Delete('schedules/:id')
  @ApiOperation({ summary: 'Delete a schedule slot' })
  deleteScheduleSlot(@Param('id') id: string) {
    return this.autoloadService.deleteScheduleSlot(id);
  }

  // ===== Active Items =====

  @Get('feeds/:id/active-items')
  @ApiOperation({ summary: 'Get currently active items based on schedule' })
  getActiveItemsForNow(@Param('id') id: string) {
    return this.autoloadService.getActiveItemsForNow(id);
  }
}
