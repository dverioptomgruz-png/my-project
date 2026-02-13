import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CompetitorsService {
  private readonly logger = new Logger(CompetitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getSnapshots(projectId: string, skip: number, take: number) {
    const [data, total] = await Promise.all([
      this.prisma.competitorSnapshot.findMany({
        where: { projectId },
        orderBy: { ts: 'desc' },
        skip,
        take,
      }),
      this.prisma.competitorSnapshot.count({ where: { projectId } }),
    ]);

    return { data, total, skip, take };
  }

  async createSnapshot(data: {
    projectId: string;
    query: string;
    resultsJson?: any;
  }) {
    return this.prisma.competitorSnapshot.create({
      data: {
        projectId: data.projectId,
        query: data.query,
        resultsJson: data.resultsJson ?? undefined,
      },
    });
  }

  async search(projectId: string, query: string) {
    const searxngUrl = this.config.get<string>('SEARXNG_URL');
    if (!searxngUrl) {
      throw new InternalServerErrorException(
        'SEARXNG_URL environment variable is not configured',
      );
    }

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories: 'general',
      });

      const response = await fetch(`${searxngUrl}/search?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `SearXNG search failed (${response.status}): ${errorBody}`,
        );
        throw new InternalServerErrorException('Search request to SearXNG failed');
      }

      const results = await response.json();

      // Save the snapshot
      const snapshot = await this.createSnapshot({
        projectId,
        query,
        resultsJson: results,
      });

      return {
        snapshot,
        results: results.results ?? [],
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(`SearXNG request error: ${error}`);
      throw new InternalServerErrorException(
        'Failed to connect to SearXNG search service',
      );
    }
  }
}
