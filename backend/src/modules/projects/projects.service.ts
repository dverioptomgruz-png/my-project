import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { CreateProjectDto, UpdateProjectDto, AddMemberDto } from './dto/projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new project. The creating user becomes both the owner
   * (Project.ownerId) and a ProjectMember with OWNER role.
   */
  async create(userId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
  }

  /** List all projects for which the user is a member. */
  async findAllForUser(userId: string) {
    return this.prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Get a single project (only if the user is a member). */
  async findOne(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this project');
    }

    return project;
  }

  /** Update a project (only owner or editor). */
  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    await this.assertMemberRole(projectId, userId, [
      'OWNER',
      'EDITOR',
    ]);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name },
      include: {
        members: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });
  }

  /** Delete a project (only owner). */
  async delete(projectId: string, userId: string) {
    await this.assertMemberRole(projectId, userId, ['OWNER']);

    await this.prisma.project.delete({ where: { id: projectId } });
    return { deleted: true };
  }

  /** Add a member to a project (only owner or editor). */
  async addMember(projectId: string, userId: string, dto: AddMemberDto) {
    await this.assertMemberRole(projectId, userId, [
      'OWNER',
      'EDITOR',
    ]);

    // Verify the target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User "${dto.userId}" not found`);
    }

    // Check for existing membership
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: dto.userId },
      },
    });
    if (existing) {
      throw new ConflictException('User is already a member of this project');
    }

    return this.prisma.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.roleInProject ,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  /** Remove a member from a project (only owner). */
  async removeMember(projectId: string, requesterId: string, targetUserId: string) {
    await this.assertMemberRole(projectId, requesterId, ['OWNER']);

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: targetUserId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    // Prevent owner from removing themselves
    if (membership.role === 'OWNER' && targetUserId === requesterId) {
      throw new ForbiddenException('Owner cannot remove themselves from the project');
    }

    await this.prisma.projectMember.delete({
      where: { id: membership.id },
    });

    return { removed: true };
  }

  // ── Helpers ───────────────────────────────────────────

  /**
   * Assert that the user is a member of the project with one of the
   * allowed roles. Throws NotFoundException or ForbiddenException.
   */
  private async assertMemberRole(
    projectId: string,
    userId: string,
    allowedRoles: string[],
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project "${projectId}" not found`);
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this project');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException(
        `Requires one of the following roles: ${allowedRoles.join(', ')}`,
      );
    }
  }
}
