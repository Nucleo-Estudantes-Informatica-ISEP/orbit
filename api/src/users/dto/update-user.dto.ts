import { IsEmail, IsOptional, IsString, IsArray, IsEnum, IsUUID, MinLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  roles?: string[];

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
