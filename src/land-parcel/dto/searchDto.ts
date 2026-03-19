import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchAddressDto {
  @ApiPropertyOptional({ example: '1/136', description: 'Land Register number (partial match supported)' })
  @IsOptional()
  @IsString()
  lr_no?: string;

  @ApiPropertyOptional({ example: 'NGARA', description: 'Physical address / admin block name' })
  @IsOptional()
  @IsString()
  physical_address?: string;

  @ApiPropertyOptional({ example: -1.2868, description: 'Latitude for proximity search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: 36.8249, description: 'Longitude for proximity search' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Search radius in meters (1–10000)', minimum: 1, maximum: 10000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(10000)
  radius?: number;
}

export class SuggestionsQueryDto {
  @ApiProperty({ example: '1/1', description: 'Search query (minimum 2 characters)' })
  @IsString()
  q: string;

  @ApiPropertyOptional({ example: 5, description: 'Maximum number of suggestions (1–20)', minimum: 1, maximum: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  limit?: number = 5;
}
