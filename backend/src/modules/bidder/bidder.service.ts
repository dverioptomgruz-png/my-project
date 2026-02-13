import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBidderRuleDto, UpdateBidderRuleDto } from './dto/bidder.dto';
import { BidderStrategy } from '@prisma/client';

@Injectable()
export class BidderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBidderRuleDto) {
    return this.prisma.bidderRule.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        strategy: dto.strategy as BidderStrategy,
        minBid: dto.minBid,
        maxBid: dto.maxBid,
        dailyBudget: dto.dailyBudget,
        schedule: dto.schedule ?? undefined,
        itemFilter: dto.itemFilter ?? undefined,
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.bidderRule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.bidderRule.findUnique({
      where: { id },
    });
    if (!rule) {
      throw new NotFoundException(`BidderRule "${id}" not found`);
    }
    return rule;
  }

  async update(id: string, dto: UpdateBidderRuleDto) {
    await this.findOne(id);

    return this.prisma.bidderRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.strategy !== undefined && { strategy: dto.strategy as BidderStrategy }),
        ...(dto.minBid !== undefined && { minBid: dto.minBid }),
        ...(dto.maxBid !== undefined && { maxBid: dto.maxBid }),
        ...(dto.dailyBudget !== undefined && { dailyBudget: dto.dailyBudget }),
        ...(dto.schedule !== undefined && { schedule: dto.schedule }),
        ...(dto.itemFilter !== undefined && { itemFilter: dto.itemFilter }),
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    await this.prisma.bidderRule.delete({ where: { id } });
    return { deleted: true };
  }

  async toggle(id: string) {
    const rule = await this.findOne(id);
    return this.prisma.bidderRule.update({
      where: { id },
      data: { enabled: !rule.enabled },
    });
  }

  async getLogs(ruleId: string, skip: number, take: number) {
    // Verify the rule exists
    await this.findOne(ruleId);

    const [data, total] = await Promise.all([
      this.prisma.bidderExecutionLog.findMany({
        where: { ruleId },
        orderBy: { ts: 'desc' },
        skip,
        take,
      }),
      this.prisma.bidderExecutionLog.count({ where: { ruleId } }),
    ]);

    return { data, total, skip, take };
  }
}
