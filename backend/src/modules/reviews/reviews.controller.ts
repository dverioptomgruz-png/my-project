import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews for a project, optionally filtered by status' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String, enum: ['NEW', 'AI_DRAFT', 'PUBLISHED', 'IGNORED'] })
  getReviews(
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.reviewsService.getReviews(projectId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single review by ID' })
  getReview(@Param('id') id: string) {
    return this.reviewsService.getReview(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new review' })
  createReview(
    @Body()
    body: {
      projectId: string;
      avitoReviewId: string;
      rating: number;
      text?: string;
      status?: string;
    },
  ) {
    return this.reviewsService.createReview(body);
  }

  @Patch(':id/ai-reply')
  @ApiOperation({ summary: 'Update the AI-generated reply for a review' })
  updateAiReply(
    @Param('id') id: string,
    @Body('aiReplyText') aiReplyText: string,
  ) {
    return this.reviewsService.updateAiReply(id, aiReplyText);
  }

  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish the AI reply for a review' })
  publishReply(@Param('id') id: string) {
    return this.reviewsService.publishReply(id);
  }
}
