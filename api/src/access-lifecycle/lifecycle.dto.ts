import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  AccessAction,
  AccessProvider,
  LifecycleKind,
  LifecycleStatus,
} from '@prisma/client';

export class SelectedOperationDto {
  @ApiPropertyOptional({
    description:
      'Discord/GitHub username. Preferred for new clients; distinguishes numeric usernames from legacy providerUserId IDs.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  accountUsername?: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() resourceId: string;
  @ApiProperty({ enum: AccessAction })
  @IsEnum(AccessAction)
  action: AccessAction;
  @ApiPropertyOptional({
    description:
      'Discord/GitHub username or Google account email. Legacy numeric account/permission IDs remain accepted. Orbit resolves and verifies remote identities.',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  providerUserId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  accountEmail?: string;
  @ApiPropertyOptional({
    description:
      'Optional operator context. Automatic identity verification is performed by Orbit, not asserted by this text.',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  verificationNote?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  exceptionReason?: string;
}

export class CreateLifecycleDto {
  @ApiProperty({ enum: LifecycleKind })
  @IsEnum(LifecycleKind)
  kind: LifecycleKind;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) targetName: string;
  @ApiProperty() @IsEmail() @MaxLength(254) targetEmail: string;
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  targetDepartmentIds: string[];
  @ApiProperty({
    type: [String],
    description:
      'ALUMNI_TRANSITION requires at least one non-Alumni origin position.',
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(
    [
      'MEMBER',
      'COORDINATOR',
      'CO_COORDINATOR',
      'BOARD',
      'PRESIDENCY',
      'ALUMNI',
    ],
    { each: true },
  )
  targetPositions: string[];
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(2000) reason: string;
  @ApiPropertyOptional({
    description:
      'Hash of a response from the selected Forms or manual Sheets origin',
  })
  @IsOptional()
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  intakeKey?: string;
  @ApiPropertyOptional({ enum: ['FORMS', 'SHEETS'] })
  @IsOptional()
  @IsIn(['FORMS', 'SHEETS'])
  intakeSource?: 'FORMS' | 'SHEETS';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  sourceNote?: string;
  @ApiProperty({ type: [SelectedOperationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SelectedOperationDto)
  selectedOperations: SelectedOperationDto[];
}

export class LifecycleQueryDto {
  @ApiPropertyOptional({
    enum: ['FORMS', 'SHEETS'],
    description:
      'Intake origin; defaults to Forms when configured, otherwise Sheets.',
  })
  @IsOptional()
  @IsIn(['FORMS', 'SHEETS'])
  intakeSource?: 'FORMS' | 'SHEETS';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
  @ApiPropertyOptional({ enum: LifecycleStatus })
  @IsOptional()
  @IsEnum(LifecycleStatus)
  status?: LifecycleStatus;
  @ApiPropertyOptional({ enum: AccessProvider })
  @IsOptional()
  @IsEnum(AccessProvider)
  provider?: AccessProvider;
  @ApiPropertyOptional({
    description:
      'Search external accounts by declared username/email or a legacy numeric ID.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(254)
  providerUserId?: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;
}

export class LifecycleDecisionDto {
  @ApiProperty() @IsBoolean() approved: boolean;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(2000) note: string;
}

export class OperationEvidenceDto {
  @ApiProperty({ enum: ['SUCCEEDED', 'AWAITING_ACCOUNT', 'FAILED', 'SKIPPED'] })
  @IsIn(['SUCCEEDED', 'AWAITING_ACCOUNT', 'FAILED', 'SKIPPED'])
  outcome: 'SUCCEEDED' | 'AWAITING_ACCOUNT' | 'FAILED' | 'SKIPPED';
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(2000) note: string;
}

export class OperationParamsDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() id: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID() operationId: string;
}

export class AccessResourceDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiProperty({ enum: AccessProvider })
  @IsEnum(AccessProvider)
  provider: AccessProvider;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) remoteId: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  containerId?: string;
  @ApiProperty({
    enum: [
      'DISCORD_ROLE',
      'GITHUB_ORG',
      'GITHUB_TEAM',
      'DRIVE_FOLDER',
      'WHATSAPP_GROUP',
      'FIGMA_TEAM',
      'MANUAL',
    ],
  })
  @IsIn([
    'DISCORD_ROLE',
    'GITHUB_ORG',
    'GITHUB_TEAM',
    'DRIVE_FOLDER',
    'WHATSAPP_GROUP',
    'FIGMA_TEAM',
    'MANUAL',
  ])
  resourceType: string;
  @ApiProperty() @IsBoolean() automatic: boolean;
  @ApiProperty() @IsBoolean() sensitive: boolean;
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  departmentIds: string[];
  @ApiProperty() @IsString() @MaxLength(2000) instructions: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(1000)
  adminUrl?: string;
}

export class UpdateAccessResourceDto extends PartialType(AccessResourceDto, {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version: number;
}

export class AccessPolicyDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  departmentIds: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsIn(
    [
      'MEMBER',
      'COORDINATOR',
      'CO_COORDINATOR',
      'BOARD',
      'PRESIDENCY',
      'ALUMNI',
    ],
    { each: true },
  )
  positions: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  resourceIds: string[];
  @ApiProperty() @IsBoolean() enabled: boolean;
}

export class UpdateAccessPolicyDto extends PartialType(AccessPolicyDto, {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) version: number;
}

export class AccessPreviewDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  departmentIds: string[];
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  positions: string[];
}

// Explicit response schemas also describe the JSON snapshots used by web/mobile clients.
export class LifecycleResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: LifecycleKind }) kind: LifecycleKind;
  @ApiProperty({ enum: LifecycleStatus }) status: LifecycleStatus;
  @ApiProperty() targetName: string;
  @ApiProperty() targetEmail: string;
  @ApiProperty({ type: [String] }) targetDepartmentIds: string[];
  @ApiProperty({ type: [String] }) targetPositions: string[];
  @ApiProperty() reason: string;
  @ApiProperty() requestedByUserId: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) source: object;
  @ApiProperty({ type: 'object', additionalProperties: true })
  policySnapshot: object;
  @ApiProperty() version: number;
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  operations: object[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  approvals: object[];
  @ApiProperty() createdAt: string;
}

export class AccessConfigurationResponseDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  resources: object[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  policies: object[];
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
  })
  departments: object[];
  @ApiProperty({ type: [String] }) permissions: string[];
  @ApiPropertyOptional() formUrl?: string;
  @ApiProperty() intakeConfigured: boolean;
  @ApiProperty({ type: [String], enum: ['FORMS', 'SHEETS'] }) intakeSources: (
    'FORMS' | 'SHEETS'
  )[];
  @ApiProperty() executorEnabled: boolean;
  @ApiProperty() dryRun: boolean;
}

export class AccessResourceResponseDto extends AccessResourceDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() version: number;
}

export class AccessPolicyResponseDto extends AccessPolicyDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() version: number;
}

export class IntakeResponseDto {
  @ApiProperty({ enum: ['FORMS', 'SHEETS'] }) source: 'FORMS' | 'SHEETS';
  @ApiPropertyOptional({ format: 'date-time' }) submittedAt?: string;
  @ApiProperty() key: string;
  @ApiProperty() name: string;
  @ApiProperty() email: string;
  @ApiProperty({ type: [String] }) departmentIds: string[];
  @ApiProperty({ type: [String] }) positions: string[];
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  accounts: Record<string, string>;
}

export class AccessPreviewResponseDto {
  @ApiProperty({ type: [AccessResourceResponseDto] })
  resources: AccessResourceResponseDto[];
  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        version: { type: 'integer' },
      },
    },
  })
  policies: object[];
}
