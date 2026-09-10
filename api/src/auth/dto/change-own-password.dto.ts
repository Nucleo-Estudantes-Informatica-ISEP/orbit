import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangeOwnPasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  current_password: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  new_password: string;
}
