import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateResourceDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  visibility?: 'PUBLIC' | 'DEPARTMENT' | 'PRIVATE';
}
