import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchAddressDto {
  @IsOptional()
  @IsString()
  lr_no?: string;

  @IsOptional()
  @IsString()
  physical_address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(10000)
  radius?: number;
}

export class SuggestionsQueryDto {
  @IsString()
  q: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
