import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  fileKey?: string;

  @IsUUID()
  departmentId: string;

  @IsUUID()
  createdById: string;
}
