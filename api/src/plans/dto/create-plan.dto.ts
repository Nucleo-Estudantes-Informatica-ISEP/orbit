import { IsString, IsOptional, IsDateString, IsUUID, IsNotEmpty } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
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
