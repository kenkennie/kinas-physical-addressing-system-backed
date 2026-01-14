import { IsNumber, IsOptional, IsString } from 'class-validator';

export class AddressSearchDto {
  @IsOptional()
  @IsString()
  lr_no?: string;

  @IsOptional()
  @IsString()
  fr_no?: string;

  @IsOptional()
  @IsString()
  admin_block?: string;

  @IsOptional()
  @IsNumber()
  lat?: number;

  @IsOptional()
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsNumber()
  radius?: number; // in meters
}
