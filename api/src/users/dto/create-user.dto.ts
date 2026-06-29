import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsUUID()
  departmentId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}
