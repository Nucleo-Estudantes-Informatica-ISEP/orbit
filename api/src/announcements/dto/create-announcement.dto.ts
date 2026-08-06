import { IsString, IsOptional, IsArray, IsBoolean, IsDateString, IsEnum, IsUUID, IsNotEmpty, ValidateIf } from 'class-validator';
import { Visibility } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @ValidateIf((announcement: CreateAnnouncementDto) =>
    announcement.content !== undefined || announcement.description === undefined,
  )
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ValidateIf((announcement: CreateAnnouncementDto) =>
    announcement.description !== undefined || announcement.content === undefined,
  )
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsUUID()
  createdById?: string;

  @IsOptional()
  @IsUUID()
  performedById?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsBoolean()
  viewed?: boolean;

  @IsOptional()
  @IsDateString()
  date?: string;
}
