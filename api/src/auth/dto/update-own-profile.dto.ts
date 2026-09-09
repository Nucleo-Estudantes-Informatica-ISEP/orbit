import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateOwnProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
