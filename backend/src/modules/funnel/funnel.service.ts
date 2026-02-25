import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface RoiCalculation {
  revenue: number;
  spend: number;
  leads: number;
}

export interface RoiResult {
  roi: number;
  romi: number;
  cpl: number;
  profit: number;
}

export interface FunnelStep {
  name: string;
  value: number;
  conversionFromPrevious: number | null;
}

@Injectable()
export class FunnelService {
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

  async getFunnelData(projectId: string, from: string, to: string) {
    const { fromDate, toDate } = this.resolveRange(from, to);

    const stats = await this.prisma.analyticsDaily.findMany({
      where: {
        projectId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // Aggregate totals across the date range
    const totals = stats.reduce(
      (acc, row) => ({
        views: acc.views + row.views,
        favorites: acc.favorites + row.favorites,
        contacts: acc.contacts + row.contacts,
        chats: acc.chats + row.chats,
        calls: acc.calls + row.calls,
        spend: acc.spend + row.spend,
      }),
      { views: 0, favorites: 0, contacts: 0, chats: 0, calls: 0, spend: 0 },
    );

    const totalLeads = totals.contacts + totals.chats + totals.calls;

    // Build funnel steps
    const steps: FunnelStep[] = [
      {
        name: 'Views',
        value: totals.views,
        conversionFromPrevious: null,
      },
      {
        name: 'Favorites',
        value: totals.favorites,
        conversionFromPrevious:
          totals.views > 0
            ? Math.round((totals.favorites / totals.views) * 10000) / 100
            : 0,
      },
      {
        name: 'Contacts',
        value: totals.contacts,
        conversionFromPrevious:
          totals.favorites > 0
            ? Math.round((totals.contacts / totals.favorites) * 10000) / 100
            : 0,
      },
      {
        name: 'Chats',
        value: totals.chats,
        conversionFromPrevious:
          totals.contacts > 0
            ? Math.round((totals.chats / totals.contacts) * 10000) / 100
            : 0,
      },
      {
        name: 'Calls',
        value: totals.calls,
        conversionFromPrevious:
          totals.chats > 0
            ? Math.round((totals.calls / totals.chats) * 10000) / 100
            : 0,
      },
    ];

    return {
      projectId,
      from,
      to,
      totals,
      totalLeads,
      steps,
    };
  }

  calculateRoi(params: RoiCalculation): RoiResult {
    const { revenue, spend, leads } = params;

    const profit = revenue - spend;
    const roi = spend > 0 ? Math.round((profit / spend) * 10000) / 100 : 0;
    const romi = spend > 0 ? Math.round(((revenue - spend) / spend) * 10000) / 100 : 0;
    const cpl = leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0;

    return { roi, romi, cpl, profit };
  }
}
