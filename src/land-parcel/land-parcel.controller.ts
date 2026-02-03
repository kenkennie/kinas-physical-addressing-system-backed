import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { LandParcelService } from './land-parcel.service';
import { SearchAddressDto, SuggestionsQueryDto } from './dto/searchDto';

@Controller('land-parcel')
export class LandParcelController {
  constructor(private readonly landParcelService: LandParcelService) {}

  @Get('tiles/:z/:x/:y.mvt')
  async getVectorTile(
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    try {
      const zNum = parseInt(z);
      const xNum = parseInt(x);
      const yNum = parseInt(y);

      // Validate tile coordinates
      if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum)) {
        return res.status(400).send('Invalid tile coordinates');
      }

      // Log the request

      const tile = await this.landParcelService.generateTile(zNum, xNum, yNum);

      // Always return something (empty tile if no data)
      res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
      res.setHeader('Access-Control-Allow-Origin', '*'); // Add CORS
      res.send(tile || Buffer.alloc(0));
    } catch (error) {
      console.error('Tile generation error:', error);
      res.status(500).send(Buffer.alloc(0)); // Return empty tile on error
    }
  }

  // Find parcel GID at specific coordinates (fallback method)
  @Get('at-point')
  async findParcelAtPoint(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return { error: 'Invalid coordinates' };
    }

    const gid = await this.landParcelService.findParcelGidAtPoint(
      latNum,
      lngNum,
    );

    return { gid };
  }

  @Post('identify')
  async getParcelDetails(@Body() body: { lat: number; lng: number }) {
    // Find parcel at clicked location
    return this.landParcelService.getParcelDetailsByLatLng(body.lat, body.lng);
  }

  // @Get(':gid')
  // async getParcelDetailsByGid(@Param('gid') gid: string) {
  //   const gidNum = parseInt(gid);
  //   if (isNaN(gidNum)) {
  //     return { error: 'Invalid GID' };
  //   }
  //   return this.landParcelService.getParcelDetailsByLatLng(gidNum);
  // }

  // Optional: Get all parcels (paginated)
  @Get()
  async getAllParcels(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.landParcelService.getAllParcels(pageNum, limitNum);
  }

  @Post('search')
  async searchAddress(@Body() searchDto: SearchAddressDto) {
    return await this.landParcelService.searchAddress(searchDto);
  }

  @Get('suggestions')
  async getSuggestions(@Query() query: SuggestionsQueryDto) {
    return await this.landParcelService.getSuggestions(query.q, query.limit);
  }
}
