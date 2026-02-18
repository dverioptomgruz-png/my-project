import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class N8nService {
  private readonly logger = new Logger(N8nService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getConfig(projectId?: string) {
    const where: any = {};
    if (projectId) {
      where.projectId = projectId;
    }

    // Gather active bidder rules
    const bidderRules = await this.prisma.bidderRule.findMany({
      where: {
        ...where,
        enabled: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Gather Avito account statuses
    const avitoAccounts = await this.prisma.avitoAccount.findMany({
      where,
      });

    // Gather latest system events
    const recentEvents = await this.prisma.systemEventLog.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      bidderRules,
      avitoAccounts,
      recentEvents,
    };
  }

  async logExecution(data: {
    module: string;
    projectId: string;
    payload: any;
  }) {
    this.logger.log(
      `n8n execution log: module=${data.module}, project=${data.projectId}`,
    );

    const event = await this.prisma.systemEventLog.create({
      data: {
        projectId: data.projectId,
            event: data.module || 'N8N_EVENT',
        module: data.module,
        level: 'INFO',
        message: `n8n execution: ${data.module}`,
        data: data.payload,
      },
    });

    return { logged: true, eventId: event.id };
  }

  async updateStatus(data: {
    module: string;
    projectId: string;
    status: string;
  }) {
    this.logger.log(
      `n8n status update: module=${data.module}, project=${data.projectId}, status=${data.status}`,
    );

    const event = await this.prisma.systemEventLog.create({
      data: {
        projectId: data.projectId,
            event: data.module || 'N8N_EVENT',
        module: data.module,
        level: 'INFO',
        message: `Workflow status update: ${data.module} -> ${data.status}`,
        data: { status: data.status },
      },
    });

    return { updated: true, eventId: event.id };
  }

  async createAlert(data: {
    projectId: string;
    level: string;
    module: string;
    message: string;
  }) {
    this.logger.warn(
      `n8n alert: level=${data.level}, module=${data.module}, message=${data.message}`,
    );

    const event = await this.prisma.systemEventLog.create({
      data: {
        projectId: data.projectId,
            event: data.module || 'N8N_EVENT',
        module: data.module,
        level: data.level ?? 'WARNING',
        message: data.message,
      },
    });

    return { alerted: true, eventId: event.id };
  }
}
