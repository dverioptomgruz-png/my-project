import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
    const now = new Date();

    let toDate = to ? new Date(to) : new Date(now);
    if (Number.isNaN(toDate.getTime())) {
      toDate = new Date(now);
    }

    let fromDate = from ? new Date(from) : new Date(toDate);
    if (Number.isNaN(fromDate.getTime())) {
      fromDate = new Date(toDate);
      fromDate.setDate(fromDate.getDate() - 30);
    }

    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      const tmp = fromDate;
      fromDate = toDate;
      toDate = tmp;
    }

    return { fromDate, toDate };
  }

  async getDailyStats(projectId: string, from: string, to: string) {
    const { fromDate, toDate } = this.resolveRange(from, to);

    return this.prisma.analyticsDaily.findMany({
      where: {
        projectId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async upsertDaily(data: {
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
  }) {
    const dateObj = new Date(data.date);

    return this.prisma.analyticsDaily.upsert({
      where: {
        projectId_date: {
          projectId: data.projectId,
          date: dateObj,
        },
      },
      create: {
        projectId: data.projectId,
        date: dateObj,
        views: data.views ?? 0,
        favorites: data.favorites ?? 0,
        contacts: data.contacts ?? 0,
        chats: data.chats ?? 0,
        calls: data.calls ?? 0,
        spend: data.spend ?? 0,
        cpl: data.cpl,
        roi: data.roi,
        romi: data.romi,
      },
      update: {
        ...(data.views !== undefined && { views: data.views }),
        ...(data.favorites !== undefined && { favorites: data.favorites }),
        ...(data.contacts !== undefined && { contacts: data.contacts }),
        ...(data.chats !== undefined && { chats: data.chats }),
        ...(data.calls !== undefined && { calls: data.calls }),
        ...(data.spend !== undefined && { spend: data.spend }),
        ...(data.cpl !== undefined && { cpl: data.cpl }),
        ...(data.roi !== undefined && { roi: data.roi }),
        ...(data.romi !== undefined && { romi: data.romi }),
      },
    });
  }

  async exportCsv(projectId: string, from: string, to: string): Promise<string> {
    const stats = await this.getDailyStats(projectId, from, to);

    const headers = [
      'date',
      'views',
      'favorites',
      'contacts',
      'chats',
      'calls',
      'spend',
      'cpl',
      'roi',
      'romi',
    ];

    const rows = stats.map((row) => [
      row.date.toISOString().split('T')[0],
      row.views,
      row.favorites,
      row.contacts,
      row.chats,
      row.calls,
      row.spend,
      row.cpl ?? '',
      row.roi ?? '',
      row.romi ?? '',
    ]);

    const csvLines = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ];

    return csvLines.join('\n');
  }
}
