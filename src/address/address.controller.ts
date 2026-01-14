import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressSearchDto } from './dto/address.dto';

@Controller('address')
export class AddressController {
  constructor(private addressService: AddressService) {}

  @Post('search')
  async searchAddress(@Body() searchDto: AddressSearchDto) {
    return await this.addressService.searchAddress(searchDto);
  }

  @Get('parcel/:lr_no')
  async getParcelDetails(@Param('lr_no') lr_no: string) {
    return await this.addressService.getParcelDetails(lr_no);
  }
}
