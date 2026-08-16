import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsString()
  performedById?: string;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsString()
  visibility?: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';

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
  date?: Date;
}
