import { IsArray, IsOptional, IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { SystemPermission } from '@prisma/client';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SystemPermission, { each: true })
  permissions?: SystemPermission[];
}
