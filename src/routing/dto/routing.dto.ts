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

export enum TransportMode {
  WALKING = 'walking',
  DRIVING = 'driving',
  CYCLING = 'cycling',
  MOTORCYCLE = 'motorcycle',
}

export class CoordinateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class CalculateRouteDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @IsNotEmpty()
  destination_lr_no: string;

  @IsEnum(TransportMode)
  mode: TransportMode;

  @IsOptional()
  @IsNumber()
  preferred_entry_point?: number;
}

export class AlternativeRoutesDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @IsNotEmpty()
  destination_lr_no: string;

  @IsEnum(TransportMode)
  mode: TransportMode;
}

export class RoutePreviewDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CoordinateDto)
  destination: CoordinateDto;

  @IsEnum(TransportMode)
  mode: TransportMode;
}
