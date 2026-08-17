import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  message: string | string[];

  @ApiPropertyOptional({ example: '/tasks' })
  path?: string;
}

export class MessageResponseDto {
  @ApiProperty()
  message: string;
}

export class CountResponseDto {
  @ApiProperty()
  count: number;
}

export class DeletedCountResponseDto {
  @ApiProperty()
  deleted: number;
}

export class NamedCountResponseDto extends CountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class UserStatsResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  inactive: number;

  @ApiProperty()
  suspended: number;

  @ApiProperty({ type: [NamedCountResponseDto] })
  byDepartment: NamedCountResponseDto[];

  @ApiProperty({ type: [NamedCountResponseDto] })
  byRole: NamedCountResponseDto[];
}

export class EntityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ additionalProperties: true })
  data?: Record<string, unknown>;
}

export class TimestampedResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class DepartmentResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;
}

export class RoleResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class UserResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] })
  status: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;

  @ApiPropertyOptional({ type: () => [UserRoleResponseDto] })
  userRoles?: UserRoleResponseDto[];
}

export class SessionUserResponseDto extends UserResponseDto {
  @ApiProperty({ type: [String] })
  roles: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];
}

export class UserRoleResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ format: 'uuid' })
  roleId: string;

  @ApiProperty({ format: 'date-time' })
  assignedAt: string;

  @ApiPropertyOptional({ type: RoleResponseDto })
  role?: RoleResponseDto;
}

export class BoardDepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  boardId: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class BoardResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ type: [BoardDepartmentResponseDto] })
  boardDepartments?: BoardDepartmentResponseDto[];
}

export class TaskAssigneeResponseDto {
  @ApiProperty({ format: 'uuid' })
  taskId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ type: UserResponseDto })
  user?: UserResponseDto;
}

export class TaskResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deadline?: string | null;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  priority: string;

  @ApiProperty({ enum: ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] })
  status: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  boardId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  projectId?: string | null;

  @ApiPropertyOptional({ type: [TaskAssigneeResponseDto] })
  taskAssignees?: TaskAssigneeResponseDto[];
}

export class ProjectMemberResponseDto {
  @ApiProperty({ format: 'uuid' })
  projectId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiPropertyOptional({ type: UserResponseDto })
  user?: UserResponseDto;
}

export class ProjectResponseDto extends TimestampedResponseDto {
  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ enum: ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] })
  status: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deadline?: string | null;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;

  @ApiPropertyOptional({ type: [ProjectMemberResponseDto] })
  projectMembers?: ProjectMemberResponseDto[];

  @ApiPropertyOptional({ type: [TaskResponseDto] })
  tasks?: TaskResponseDto[];
}

export class CandidateDepartmentChoiceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  candidateId: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiProperty()
  priority: number;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class CandidateResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ format: 'email' })
  email: string;

  @ApiPropertyOptional({ nullable: true })
  course?: string | null;

  @ApiPropertyOptional({ nullable: true })
  year?: number | null;

  @ApiPropertyOptional({ nullable: true })
  cvUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;

  @ApiProperty({ enum: ['RECEIVED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'] })
  stage: string;

  @ApiPropertyOptional({ type: [CandidateDepartmentChoiceResponseDto] })
  departmentChoices?: CandidateDepartmentChoiceResponseDto[];
}

export class RecruitmentCommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  candidateId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById?: string | null;

  @ApiProperty()
  content: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiPropertyOptional({ type: UserResponseDto })
  createdBy?: UserResponseDto;
}

export class UserSettingsResponseDto extends TimestampedResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  darkMode: boolean;

  @ApiProperty()
  emailNotifications: boolean;

  @ApiProperty()
  inAppNotifications: boolean;

  @ApiProperty()
  language: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  performedById?: string | null;

  @ApiProperty()
  action: string;

  @ApiProperty()
  entity: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class AnnouncementDepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  announcementId: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class AnnouncementResponseDto extends TimestampedResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  targetUserId?: string | null;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  type: string;

  @ApiProperty({ enum: ['PUBLIC', 'DEPARTMENT', 'PRIVATE'] })
  visibility: string;

  @ApiProperty()
  read: boolean;

  @ApiProperty()
  pinned: boolean;

  @ApiPropertyOptional({ type: UserResponseDto })
  createdBy?: UserResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto })
  targetUser?: UserResponseDto;

  @ApiPropertyOptional({ type: [AnnouncementDepartmentResponseDto] })
  announcementDepartments?: AnnouncementDepartmentResponseDto[];
}

export class ResourceDepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  resourceId: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class ResourceResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  title: string;

  @ApiProperty()
  url: string;

  @ApiPropertyOptional({ nullable: true })
  category?: string | null;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ enum: ['PUBLIC', 'DEPARTMENT', 'PRIVATE'] })
  visibility: string;

  @ApiPropertyOptional({ type: [ResourceDepartmentResponseDto] })
  resourceDepartments?: ResourceDepartmentResponseDto[];
}

export class EventDepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class EventResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  location?: string | null;

  @ApiProperty({ format: 'date-time' })
  startDate: string;

  @ApiProperty({ format: 'date-time' })
  endDate: string;

  @ApiProperty({ enum: ['PUBLIC', 'DEPARTMENT', 'PRIVATE'] })
  visibility: string;

  @ApiPropertyOptional({ type: [EventDepartmentResponseDto] })
  eventDepartments?: EventDepartmentResponseDto[];
}

export class InventoryItemResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ type: String, example: '19.99' })
  value: string;

  @ApiProperty()
  quantity: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  purchasedById?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  departmentId?: string | null;

  @ApiPropertyOptional({ type: UserResponseDto })
  purchasedBy?: UserResponseDto;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;
}

export class PlanResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  status: string;

  @ApiProperty({ format: 'uuid' })
  departmentId: string;

  @ApiProperty({ format: 'uuid' })
  createdById: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  approvedById?: string | null;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto })
  createdBy?: UserResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto })
  approvedBy?: UserResponseDto;
}

export class DebtResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  description: string;

  @ApiProperty({ type: String, example: '19.99' })
  value: string;

  @ApiProperty({ enum: ['INCOME', 'OUTCOME'] })
  type: string;

  @ApiProperty({ enum: ['PENDING', 'COMPLETED'] })
  status: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;

  @ApiProperty({ type: [String] })
  fileKeys: string[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById?: string | null;

  @ApiPropertyOptional({ type: UserResponseDto })
  createdBy?: UserResponseDto;
}

export class IncidentCommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  incidentId: string;

  @ApiProperty()
  content: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class IncidentResponseDto extends TimestampedResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt: string;

  @ApiProperty({ enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] })
  priority: string;

  @ApiProperty({ enum: ['OPEN', 'ANALYZING', 'RESOLVING', 'RESOLVED', 'CLOSED'] })
  status: string;

  @ApiProperty({ type: [String] })
  fileKeys: string[];

  @ApiPropertyOptional({ type: [IncidentCommentResponseDto] })
  comments?: IncidentCommentResponseDto[];

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  departmentId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  createdById?: string | null;

  @ApiPropertyOptional({ type: DepartmentResponseDto })
  department?: DepartmentResponseDto;

  @ApiPropertyOptional({ type: UserResponseDto })
  createdBy?: UserResponseDto;
}

export class PaginatedResponseDto {
  @ApiProperty({ type: [EntityResponseDto] })
  items: unknown[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class PaginatedAnnouncementResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: () => [AnnouncementResponseDto] })
  declare items: AnnouncementResponseDto[];
}

export class PaginatedEventResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: () => [EventResponseDto] })
  declare items: EventResponseDto[];
}

export class PaginatedResourceResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: () => [ResourceResponseDto] })
  declare items: ResourceResponseDto[];
}

export class StoredFileResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  size: number;

  @ApiProperty({ format: 'date-time' })
  lastModified: string;
}

export class PaginatedFileResponseDto extends PaginatedResponseDto {
  @ApiProperty({ type: [StoredFileResponseDto] })
  declare items: StoredFileResponseDto[];
}

export class AuthTokensResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty()
  refresh_token: string;

  @ApiProperty({ type: SessionUserResponseDto })
  user: SessionUserResponseDto;
}

export class AccessTokenResponseDto {
  @ApiProperty()
  access_token: string;
}

export class FileResponseDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;
}
