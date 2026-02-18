import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
// EventLevel enum removed - using string type

export interface ServiceStatus {
  name: string;
  url: string;
  status: 'ok' | 'error';
  responseTimeMs: number | null;
  error?: string;
}

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getHealth() {
    let dbStatus: 'ok' | 'error' = 'ok';
    let dbResponseMs = 0;
    let dbError: string | undefined;

    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbResponseMs = Date.now() - start;
    } catch (error) {
      dbStatus = 'error';
      dbResponseMs = Date.now() - start;
      dbError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health check failed: ${dbError}`);
    }

    return {
      status: dbStatus,
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        responseTimeMs: dbResponseMs,
        ...(dbError && { error: dbError }),
      },
    };
  }

  async getEvents(
    projectId: string | undefined,
    level: string | undefined,
    skip: number,
    take: number,
  ) {
    const where: any = {};
    if (projectId) {
      where.projectId = projectId;
    }
    if (level) {
      where.level = level;
    }

    const [data, total] = await Promise.all([
      this.prisma.systemEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.systemEventLog.count({ where }),
    ]);

    return { data, total, skip, take };
  }

  async getServiceStatuses(): Promise<ServiceStatus[]> {
    const services: ServiceStatus[] = [];

    // Check n8n
    const n8nUrl = this.config.get<string>('N8N_URL', 'http://n8n:5678');
    services.push(await this.pingService('n8n', n8nUrl));

    // Check SearXNG
    const searxngUrl = this.config.get<string>('SEARXNG_URL', 'http://searxng:8080');
    services.push(await this.pingService('searxng', searxngUrl));

    return services;
  }

  private async pingService(name: string, url: string): Promise<ServiceStatus> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const responseTimeMs = Date.now() - start;

      return {
        name,
        url,
        status: response.ok ? 'ok' : 'error',
        responseTimeMs,
        ...((!response.ok) && { error: `HTTP ${response.status}` }),
      };
    } catch (error) {
      const responseTimeMs = Date.now() - start;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Service ping failed for ${name} (${url}): ${errorMsg}`);

      return {
        name,
        url,
        status: 'error',
        responseTimeMs,
        error: errorMsg,
      };
    }
  }
}
