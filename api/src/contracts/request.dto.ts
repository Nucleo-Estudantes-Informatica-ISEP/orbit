import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import {
  DebtStatus,
  DebtType,
  IncidentPriority,
  IncidentStatus,
  Priority,
  ProjectStatus,
  RecruitmentStage,
  TaskStatus,
  Visibility,
  PlanStatus,
} from '@prisma/client';

export class IdParamDto {
  @IsUUID()
  id: string;
}

export class UserIdParamDto {
  @IsUUID()
  userId: string;
}

export class CommentIdParamDto {
  @IsUUID()
  commentId: string;
}

export class CandidateIdParamDto {
  @IsUUID()
  candidateId: string;
}

export class FileKeyParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  @Matches(/^[^\\\0]+$/)
  key: string;
}

export class ProjectMemberParamDto extends IdParamDto {
  @IsUUID()
  userId: string;
}

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

export class CreateBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  departmentIds?: string[];
}

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  departmentIds?: string[];
}

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  action: string;

  @IsString()
  @IsNotEmpty()
  entity: string;

  @IsString()
  @IsNotEmpty()
  entityId: string;
}

export class CreateDebtDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @IsEnum(DebtType)
  type: DebtType;

  @IsOptional()
  @IsEnum(DebtStatus)
  status?: DebtStatus;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  debtorName?: string;

  @IsOptional()
  @IsString()
  debtorContact?: string;

  @IsOptional()
  @IsString()
  creditorName?: string;

  @IsOptional()
  @IsString()
  creditorContact?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileKeys?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  receivingAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  depositAccount?: string;
}

export class UpdateDebtDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value?: number;

  @IsOptional()
  @IsEnum(DebtType)
  type?: DebtType;

  @IsOptional()
  @IsEnum(DebtStatus)
  status?: DebtStatus;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  debtorName?: string;

  @IsOptional()
  @IsString()
  debtorContact?: string;

  @IsOptional()
  @IsString()
  creditorName?: string;

  @IsOptional()
  @IsString()
  creditorContact?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileKeys?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  receivingAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  depositAccount?: string;
}

export class DebtQueryDto {
  @IsOptional()
  @IsEnum(DebtType)
  type?: DebtType;
}

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileKeys?: string[];
}

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsEnum(IncidentPriority)
  priority?: IncidentPriority;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  fileKeys?: string[];
}

export class IncidentQueryDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CreateIncidentCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateProjectDto {
  @IsUUID()
  departmentId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  deadline?: string;
}

export class ProjectMemberDto {
  @IsUUID()
  userId: string;
}

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  assigneeIds?: string[];
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  assigneeIds?: string[];
}

export class TaskQueryDto {
  @IsOptional()
  @IsUUID()
  boardId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}

export class CandidateDepartmentChoiceDto {
  @IsUUID()
  departmentId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  priority: number;
}

export class CreateCandidateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  year?: number;

  @IsOptional()
  @IsString()
  cvUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RecruitmentStage)
  stage?: RecruitmentStage;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CandidateDepartmentChoiceDto)
  departmentChoices?: CandidateDepartmentChoiceDto[];
}

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  course?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  year?: number;

  @IsOptional()
  @IsString()
  cvUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(RecruitmentStage)
  stage?: RecruitmentStage;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CandidateDepartmentChoiceDto)
  departmentChoices?: CandidateDepartmentChoiceDto[];
}

export class CreateRecruitmentCommentDto {
  @IsUUID()
  candidateId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CreateUserSettingsDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;
}

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsBoolean()
  darkMode?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppNotifications?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;
}

export class TransferDepartmentDto {
  @IsUUID()
  destinationDepartmentId: string;
}

export class TransferRoleDto {
  @IsUUID()
  destinationRoleId: string;
}

export class PlanDecisionDto {
  @IsOptional()
  @IsString()
  rejectionNote?: string;
}

export class AnnouncementQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum({ ALL: 'ALL', ...Visibility })
  visibility?: Visibility | 'ALL';
}

export class EventQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum({ ALL: 'ALL', UPCOMING: 'UPCOMING' })
  filter?: 'ALL' | 'UPCOMING';
}

export class ResourceQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class PlanQueryDto {
  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}
