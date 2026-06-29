import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  fileKey?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
