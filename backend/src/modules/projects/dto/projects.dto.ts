import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ example: 'My Avito Project' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateProjectDto {
  @ApiProperty({ example: 'Renamed Project', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class AddMemberDto {
  @ApiProperty({ example: 'clu1a2b3c0001...' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ example: 'EDITOR', enum: ['OWNER', 'EDITOR', 'VIEWER'] })
  @IsString()
  @IsIn(['OWNER', 'EDITOR', 'VIEWER'])
  roleInProject: string;
}
