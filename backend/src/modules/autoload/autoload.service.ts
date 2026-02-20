import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class AutoloadService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Reports (existing) =====

  async getReports(projectId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.autoloadReport.findMany({
        where: { projectId },
        orderBy: { ts: 'desc' },
        skip,
        take,
      }),
      this.prisma.autoloadReport.count({ where: { projectId } }),
    ]);

    return { data, total, skip, take };
  }

  async getReport(id: string) {
    const report = await this.prisma.autoloadReport.findUnique({
      where: { id },
    });
    if (!report) {
      throw new NotFoundException(`AutoloadReport "${id}" not found`);
    }
    return report;
  }

  async createReport(data: {
    projectId: string;
    total: number;
    ok: number;
    failed: number;
    rawJson?: any;
  }) {
    return this.prisma.autoloadReport.create({
      data: {
        projectId: data.projectId,
        total: data.total,
        ok: data.ok,
        failed: data.failed,
        rawJson: data.rawJson ?? undefined,
      },
    });
  }

  // ===== Feeds =====

  async createFeed(dto: CreateAutoloadFeedDto) {
    return this.prisma.autoloadFeed.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        spreadsheetId: dto.spreadsheetId,
        spreadsheetUrl: dto.spreadsheetUrl,
        autoPublish: dto.autoPublish ?? false,
        defaultBid: dto.defaultBid,
        defaultBidType: dto.defaultBidType,
        cronExpression: dto.cronExpression,
      },
    });
  }

  async getFeeds(projectId: string) {
    return this.prisma.autoloadFeed.findMany({
      where: { projectId },
      include: {
        _count: { select: { items: true, schedules: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFeed(id: string) {
    const feed = await this.prisma.autoloadFeed.findUnique({
      where: { id },
      include: {
        items: { orderBy: { createdAt: 'desc' } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
    if (!feed) {
      throw new NotFoundException(`AutoloadFeed "${id}" not found`);
    }
    return feed;
  }

  async updateFeed(id: string, dto: UpdateAutoloadFeedDto) {
    await this.getFeed(id);
    return this.prisma.autoloadFeed.update({
      where: { id },
      data: {
        name: dto.name,
        spreadsheetId: dto.spreadsheetId,
        spreadsheetUrl: dto.spreadsheetUrl,
        autoPublish: dto.autoPublish,
        defaultBid: dto.defaultBid,
        defaultBidType: dto.defaultBidType,
        cronExpression: dto.cronExpression,
        status: dto.status as any,
      },
    });
  }

  async deleteFeed(id: string) {
    await this.getFeed(id);
    return this.prisma.autoloadFeed.delete({ where: { id } });
  }

  // ===== Items =====

  async createItem(dto: CreateAutoloadItemDto) {
    return this.prisma.autoloadItem.create({
      data: {
        feedId: dto.feedId,
        externalId: dto.externalId,
        title: dto.title,
        category: dto.category,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        unpublishAt: dto.unpublishAt ? new Date(dto.unpublishAt) : undefined,
        bid: dto.bid,
        bidType: dto.bidType,
        cityBids: dto.cityBids ?? undefined,
        scheduleSlots: dto.scheduleSlots ?? undefined,
        price: dto.price,
        rawData: dto.rawData ?? undefined,
      },
    });
  }

  async getItems(feedId: string, skip = 0, take = 50) {
    const [data, total] = await Promise.all([
      this.prisma.autoloadItem.findMany({
        where: { feedId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.autoloadItem.count({ where: { feedId } }),
    ]);
    return { data, total, skip, take };
  }

  async getItem(id: string) {
    const item = await this.prisma.autoloadItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`AutoloadItem "${id}" not found`);
    }
    return item;
  }

  async updateItem(id: string, dto: UpdateAutoloadItemDto) {
    await this.getItem(id);
    return this.prisma.autoloadItem.update({
      where: { id },
      data: {
        title: dto.title,
        category: dto.category,
        status: dto.status as any,
        publishAt: dto.publishAt ? new Date(dto.publishAt) : undefined,
        unpublishAt: dto.unpublishAt ? new Date(dto.unpublishAt) : undefined,
        bid: dto.bid,
        bidType: dto.bidType,
        cityBids: dto.cityBids ?? undefined,
        scheduleSlots: dto.scheduleSlots ?? undefined,
        price: dto.price,
        rawData: dto.rawData ?? undefined,
      },
    });
  }

  async deleteItem(id: string) {
    await this.getItem(id);
    return this.prisma.autoloadItem.delete({ where: { id } });
  }

  // ===== Item Bids =====

  async setItemBid(id: string, dto: SetItemBidDto) {
    await this.getItem(id);
    return this.prisma.autoloadItem.update({
      where: { id },
      data: {
        bid: dto.bid,
        bidType: dto.bidType,
        cityBids: dto.cityBids ?? undefined,
      },
    });
  }

  async bulkSetBids(dto: BulkSetBidsDto) {
    const updates = dto.itemIds.map((itemId) =>
      this.prisma.autoloadItem.update({
        where: { id: itemId },
        data: {
          bid: dto.bid,
          bidType: dto.bidType,
          cityBids: dto.cityBids ?? undefined,
        },
      }),
    );
    return this.prisma.$transaction(updates);
  }

  // ===== Schedule Slots =====

  async createScheduleSlot(dto: CreateScheduleSlotDto) {
    return this.prisma.autoloadScheduleSlot.create({
      data: {
        feedId: dto.feedId,
        dayOfWeek: dto.dayOfWeek,
        startHour: dto.startHour,
        endHour: dto.endHour,
        enabled: dto.enabled ?? true,
        bid: dto.bid,
        bidType: dto.bidType,
      },
    });
  }

  async getScheduleSlots(feedId: string) {
    return this.prisma.autoloadScheduleSlot.findMany({
      where: { feedId },
      orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }],
    });
  }

  async updateScheduleSlot(id: string, dto: UpdateScheduleSlotDto) {
    const slot = await this.prisma.autoloadScheduleSlot.findUnique({ where: { id } });
    if (!slot) {
      throw new NotFoundException(`AutoloadScheduleSlot "${id}" not found`);
    }
    return this.prisma.autoloadScheduleSlot.update({
      where: { id },
      data: {
        dayOfWeek: dto.dayOfWeek,
        startHour: dto.startHour,
        endHour: dto.endHour,
        enabled: dto.enabled,
        bid: dto.bid,
        bidType: dto.bidType,
      },
    });
  }

  async deleteScheduleSlot(id: string) {
    return this.prisma.autoloadScheduleSlot.delete({ where: { id } });
  }

  // ===== Active items by schedule =====

  async getActiveItemsForNow(feedId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    const activeSlots = await this.prisma.autoloadScheduleSlot.findMany({
      where: {
        feedId,
        enabled: true,
        dayOfWeek,
        startHour: { lte: hour },
        endHour: { gt: hour },
      },
    });

    const items = await this.prisma.autoloadItem.findMany({
      where: {
        feedId,
        status: { in: ['ACTIVE', 'SCHEDULED'] },
        OR: [
          { publishAt: null },
          { publishAt: { lte: now } },
        ],
        AND: [
          {
            OR: [
              { unpublishAt: null },
              { unpublishAt: { gt: now } },
            ],
          },
        ],
      },
    });

    return {
      activeSlots,
      items,
      currentDay: dayOfWeek,
      currentHour: hour,
    };
  }
}
