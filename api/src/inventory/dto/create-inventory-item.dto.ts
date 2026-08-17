import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInventoryItemDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyDate?: string;

  @IsOptional()
  @IsString()
  photoKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsUUID()
  purchasedById?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
