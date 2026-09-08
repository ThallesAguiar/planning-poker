import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn(['PUBLIC', 'PRIVATE'])
  visibility?: 'PUBLIC' | 'PRIVATE';

  @IsOptional()
  @IsString()
  @MinLength(4)
  password?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateStoryDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class JoinRoomDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class UpdateRoomProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}

export class RequestRoleChangeDto {
  @IsString()
  @IsIn(['PO', 'Dev', 'QA', 'ScrumMaster', 'Observador'])
  role!: string;
}

export class DecideRoleChangeDto {
  @IsString()
  requestId!: string;

  @IsString()
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';
}

export class DecideJoinRequestDto {
  @IsString()
  requestId!: string;

  @IsString()
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';
}
