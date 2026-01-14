import {
  IsEnum,
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

export class RouteRequestDto {
  @ValidateNested()
  @Type(() => CoordinateDto)
  origin: CoordinateDto;

  @IsString()
  destination_lr_no: string; // Parcel LR number

  @IsEnum(TransportMode)
  mode: TransportMode;

  @IsOptional()
  @IsNumber()
  preferred_entry_point?: number; // Entry point label
}
