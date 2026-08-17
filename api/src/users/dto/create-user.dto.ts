import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  roles?: string[];

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
