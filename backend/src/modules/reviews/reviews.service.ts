import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewStatus } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReviews(projectId: string, status?: string) {
    const where: any = { projectId };
    if (status) {
      where.status = status as ReviewStatus;
    }

    return this.prisma.review.findMany({
      where,
      orderBy: { ts: 'desc' },
    });
  }

  async getReview(id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });
    if (!review) {
      throw new NotFoundException(`Review "${id}" not found`);
    }
    return review;
  }

  async createReview(data: {
    projectId: string;
    avitoReviewId: string;
    rating: number;
    text?: string;
    status?: string;
  }) {
    return this.prisma.review.create({
      data: {
        projectId: data.projectId,
        avitoReviewId: data.avitoReviewId,
        rating: data.rating,
        text: data.text,
        status: (data.status as ReviewStatus) ?? ReviewStatus.NEW,
      },
    });
  }

  async updateAiReply(id: string, aiReplyText: string) {
    await this.getReview(id);

    return this.prisma.review.update({
      where: { id },
      data: {
        aiReplyText,
        status: ReviewStatus.AI_DRAFT,
      },
    });
  }

  async publishReply(id: string) {
    const review = await this.getReview(id);

    return this.prisma.review.update({
      where: { id },
      data: {
        published: true,
        status: ReviewStatus.PUBLISHED,
      },
    });
  }
}
