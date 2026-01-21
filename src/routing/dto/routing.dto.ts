import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
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
  lat: number;

  @IsNumber()
  lng: number;
}

export class CalculateRouteDto {
  @IsNotEmpty()
  gid: number;

  @IsNotEmpty()
  origin: CoordinateDto;

  @IsNotEmpty()
  destination_lr_no: string;

  @IsEnum(TransportMode)
  mode: TransportMode;

  @IsOptional()
  @IsNumber()
  preferred_entry_point?: number; // Entry point GID
}

export class AlternativeRoutesDto {
  @IsNotEmpty()
  origin: CoordinateDto;

  @IsNotEmpty()
  destination_lr_no: string;

  @IsEnum(TransportMode)
  mode: TransportMode;
}
