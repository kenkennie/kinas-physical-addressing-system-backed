import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { AddressSearchDto } from './dto/address.dto';

@ApiTags('address')
@Controller('address')
export class AddressController {
  constructor(private addressService: AddressService) {}

  @Post('search')
  @ApiOperation({ summary: 'Search addresses', description: 'Search parcels by LR number, FR number, admin block or proximity. Returns full parcel context with entry points and nearby roads.' })
  async searchAddress(@Body() searchDto: AddressSearchDto) {
    return await this.addressService.searchAddress(searchDto);
  }

  @Get('parcel/:lr_no')
  @ApiOperation({ summary: 'Get parcel details by LR number', description: 'Returns full address context for a land parcel including entry points, nearby roads and administrative block.' })
  @ApiParam({ name: 'lr_no', description: 'Land Register number (URL encode the slash: 1%2F136)', example: '1%2F136' })
  async getParcelDetails(@Param('lr_no') lr_no: string) {
    return await this.addressService.getParcelDetails(lr_no);
  }
}
