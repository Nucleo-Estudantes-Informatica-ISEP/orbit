import { IsString, IsOptional, IsArray, IsDateString, IsEnum, IsUUID, IsNotEmpty, ValidateIf } from 'class-validator';
import { Visibility } from '@prisma/client';

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @ValidateIf((event: CreateEventDto) => event.startDate === undefined)
  @IsDateString()
  start?: string;

  @ValidateIf((event: CreateEventDto) => event.endDate === undefined)
  @IsDateString()
  end?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  departmentIds?: string[];

  @ValidateIf((event: CreateEventDto) => event.start === undefined)
  @IsDateString()
  startDate?: string;

  @ValidateIf((event: CreateEventDto) => event.end === undefined)
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsUUID()
  performedById?: string;
}
