// src/routing/dto/route.dto.ts
import {
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransportMode {
  WALKING = 'walking',
  DRIVING = 'driving',
  CYCLING = 'cycling',
  MOTORCYCLE = 'motorcycle',
}

export class CoordinateDto {
  @ApiProperty({ example: -1.2868, description: 'Latitude (-90 to 90)' })
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @ApiProperty({ example: 36.8249, description: 'Longitude (-180 to 180)' })
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class CalculateRouteDto {
  @ApiProperty({ type: CoordinateDto, description: 'Origin coordinates' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @ApiProperty({ example: '1/136', description: 'Destination land parcel LR number' })
  @IsNotEmpty()
  destination_lr_no: string;

  @ApiProperty({ enum: TransportMode, example: TransportMode.DRIVING, description: 'Mode of transport' })
  @IsEnum(TransportMode)
  mode: TransportMode;

  @ApiPropertyOptional({ example: 1, description: 'Preferred entry point GID' })
  @IsOptional()
  @IsNumber()
  preferred_entry_point?: number;
}

export class AlternativeRoutesDto {
  @ApiProperty({ type: CoordinateDto, description: 'Origin coordinates' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @ApiProperty({ example: '1/136', description: 'Destination land parcel LR number' })
  @IsNotEmpty()
  destination_lr_no: string;

  @ApiProperty({ enum: TransportMode, example: TransportMode.DRIVING, description: 'Mode of transport' })
  @IsEnum(TransportMode)
  mode: TransportMode;
}

export class RoutePreviewDto {
  @ApiProperty({ type: CoordinateDto, description: 'Origin coordinates' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @ApiProperty({ type: CoordinateDto, description: 'Destination coordinates' })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  destination: CoordinateDto;

  @ApiProperty({ enum: TransportMode, example: TransportMode.DRIVING, description: 'Mode of transport' })
  @IsEnum(TransportMode)
  mode: TransportMode;
}
