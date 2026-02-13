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
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('threads')
  @ApiOperation({ summary: 'List chat threads for a project, optionally filtered by status' })
  @ApiQuery({ name: 'projectId', required: true, type: String })
  @ApiQuery({ name: 'status', required: false, type: String, enum: ['OPEN', 'AI_HANDLED', 'MANUAL', 'CLOSED'] })
  getThreads(
    @Query('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.chatService.getThreads(projectId, status);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get a single chat thread by ID' })
  getThread(@Param('id') id: string) {
    return this.chatService.getThread(id);
  }

  @Get('threads/:id/messages')
  @ApiOperation({ summary: 'Get all messages for a chat thread' })
  getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Create a new chat thread' })
  createThread(
    @Body()
    body: {
      projectId: string;
      avitoChatId: string;
      status?: string;
      assignedToId?: string;
    },
  ) {
    return this.chatService.createThread(body);
  }

  @Post('threads/:id/messages')
  @ApiOperation({ summary: 'Add a message to a chat thread' })
  addMessage(
    @Param('id') id: string,
    @Body()
    body: {
      direction: string;
      text: string;
      aiGenerated?: boolean;
      rawJson?: any;
    },
  ) {
    return this.chatService.addMessage(id, body);
  }

  @Patch('threads/:id/status')
  @ApiOperation({ summary: 'Update the status of a chat thread' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.chatService.updateStatus(id, status);
  }
}
