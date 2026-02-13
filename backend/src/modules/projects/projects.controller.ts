import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreateProjectDto,
  UpdateProjectDto,
  AddMemberDto,
} from './dto/projects.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project (caller becomes owner)' })
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List projects the current user is a member of' })
  findAll(@CurrentUser('sub') userId: string) {
    return this.projectsService.findAllForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID (must be a member)' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.findOne(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project (owner or editor)' })
  update(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project (owner only)' })
  delete(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.projectsService.delete(id, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member to the project (owner or editor)' })
  addMember(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.projectsService.addMember(id, userId, dto);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: 'Remove a member from the project (owner only)' })
  removeMember(
    @Param('id') projectId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser('sub') requesterId: string,
  ) {
    return this.projectsService.removeMember(projectId, requesterId, targetUserId);
  }
}
