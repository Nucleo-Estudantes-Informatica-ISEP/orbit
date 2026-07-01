import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'A palavra-passe deve ter pelo menos 8 caracteres.' })
  password: string;
}
