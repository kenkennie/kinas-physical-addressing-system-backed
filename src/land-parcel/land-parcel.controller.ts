import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { LandParcelService } from './land-parcel.service';

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
    // Generate vector tile for this map area
    const tile = await this.landParcelService.generateTile(
      parseInt(z),
      parseInt(x),
      parseInt(y),
    );
    console.log('Generated tile size :', tile ? tile.length : 'null');

    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.send(tile);
  }

  @Post('identify')
  async identifyParcel(@Body() body: { lat: number; lng: number }) {
    // Find parcel at clicked location

    return this.landParcelService.findParcelAtPoint(body.lat, body.lng);
  }

  @Get()
  async hello() {
    return { message: 'Land Parcel Service is running' };
  }
}
