import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';


@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getThreads(projectId: string, status?: string) {
    const where: any = { projectId };
    if (status) {
      where.status = status ;
    }

    return this.prisma.chatThread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        assignedTo: {
          select: { id: true, email: true, name: true },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  async getThread(threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      include: {
        assignedTo: {
          select: { id: true, email: true, name: true },
        },
        _count: { select: { messages: true } },
      },
    });
    if (!thread) {
      throw new NotFoundException(`ChatThread "${threadId}" not found`);
    }
    return thread;
  }

  async getMessages(threadId: string) {
    // Verify thread exists
    await this.getThread(threadId);

    return this.prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { ts: 'asc' },
    });
  }

  async createThread(data: {
    projectId: string;
    avitoChatId: string;
    status?: string;
    assignedToId?: string;
  }) {
    return this.prisma.chatThread.create({
      data: {
        projectId: data.projectId,
        avitoChatId: data.avitoChatId,
        status: (data.status ) ?? 'OPEN',
        assignedToId: data.assignedToId,
      },
      include: {
        assignedTo: {
          select: { id: true, email: true, name: true },
        },
      },
    });
  }

  async addMessage(
    threadId: string,
    data: {
      direction: string;
      text: string;
      aiGenerated?: boolean;
      rawJson?: any;
    },
  ) {
    // Verify thread exists
    await this.getThread(threadId);

    const message = await this.prisma.chatMessage.create({
      data: {
        threadId,
        direction: data.direction ,
        text: data.text,
        aiGenerated: data.aiGenerated ?? false,
        rawJson: data.rawJson ?? undefined,
      },
    });

    // Update thread's lastMessageAt
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  async updateStatus(threadId: string, status: string) {
    await this.getThread(threadId);

    return this.prisma.chatThread.update({
      where: { id: threadId },
      data: { status: status  },
    });
  }
}
