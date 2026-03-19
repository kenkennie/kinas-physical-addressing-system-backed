import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddressSearchDto {
  @ApiPropertyOptional({ example: '1/136', description: 'Land Register number' })
  @IsOptional()
  @IsString()
  lr_no?: string;

  @ApiPropertyOptional({ example: '85/22', description: 'Folio Register number' })
  @IsOptional()
  @IsString()
  fr_no?: string;

  @ApiPropertyOptional({ example: 'NGARA', description: 'Administrative block name' })
  @IsOptional()
  @IsString()
  admin_block?: string;

  @ApiPropertyOptional({ example: -1.2868, description: 'Latitude coordinate' })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 36.8249, description: 'Longitude coordinate' })
  @IsOptional()
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 1000, description: 'Search radius in meters' })
  @IsOptional()
  @IsNumber()
  radius?: number;
}
