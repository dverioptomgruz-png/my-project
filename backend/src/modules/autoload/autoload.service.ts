import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AutoloadService {
  constructor(private readonly prisma: PrismaService) {}

  async getReports(projectId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.autoloadReport.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
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
}
