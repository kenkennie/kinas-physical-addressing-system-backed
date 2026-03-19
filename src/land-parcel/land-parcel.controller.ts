import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { LandParcelService } from './land-parcel.service';
import { SearchAddressDto, SuggestionsQueryDto } from './dto/searchDto';

@ApiTags('land-parcel')
@Controller('land-parcel')
export class LandParcelController {
  constructor(private readonly landParcelService: LandParcelService) {}

  @Get('tiles/:z/:x/:y.mvt')
  @ApiOperation({ summary: 'Get vector tile for land parcels', description: 'Returns a Mapbox Vector Tile (MVT) for the given tile coordinates. Use with a map renderer like Mapbox GL JS.' })
  @ApiParam({ name: 'z', description: 'Zoom level', example: 15 })
  @ApiParam({ name: 'x', description: 'Tile X coordinate', example: 24310 })
  @ApiParam({ name: 'y', description: 'Tile Y coordinate', example: 15742 })
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

      if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum)) {
        return res.status(400).send('Invalid tile coordinates');
      }

      const tile = await this.landParcelService.generateTile(zNum, xNum, yNum);

      res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(tile || Buffer.alloc(0));
    } catch (error) {
      console.error('Tile generation error:', error);
      res.status(500).send(Buffer.alloc(0));
    }
  }

  @Get('at-point')
  @ApiOperation({ summary: 'Find parcel GID at coordinates', description: 'Returns the GID of the land parcel at the given coordinates.' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: -1.2868 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: 36.8249 })
  async findParcelAtPoint(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return { error: 'Invalid coordinates' };
    }

    const gid = await this.landParcelService.findParcelGidAtPoint(latNum, lngNum);
    return { gid };
  }

  @Post('identify')
  @ApiOperation({ summary: 'Get full parcel details by coordinates', description: 'Returns complete parcel context including entry points, nearest roads and administrative block for the parcel at the given coordinates.' })
  @ApiBody({ schema: { example: { lat: -1.2868, lng: 36.8249 } } })
  async getParcelDetails(@Body() body: { lat: number; lng: number }) {
    return this.landParcelService.getParcelDetailsByLatLng(body.lat, body.lng);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete LR number suggestions', description: 'Returns matching land parcels for autocomplete/typeahead based on LR number query.' })
  async getSuggestions(@Query() query: SuggestionsQueryDto) {
    return await this.landParcelService.getSuggestions(query.q, query.limit || 5);
  }

  @Post('search')
  @ApiOperation({ summary: 'Search parcels', description: 'Search parcels by LR number, physical address or proximity. Returns full parcel context for each match.' })
  async searchAddress(@Body() searchDto: SearchAddressDto) {
    return await this.landParcelService.searchAddress(searchDto);
  }

  @Get(':gid')
  @ApiOperation({ summary: 'Get parcel by GID', description: 'Returns full parcel context including entry points, nearest roads and administrative block.' })
  @ApiParam({ name: 'gid', description: 'Parcel GID', example: 1 })
  async getParcelDetailsByGid(@Param('gid') gid: string) {
    const parsedGid = parseInt(gid, 10);
    if (isNaN(parsedGid)) {
      return { error: 'Invalid GID' };
    }
    return await this.landParcelService.getParcelContextByGid(parsedGid);
  }

  @Get()
  @ApiOperation({ summary: 'Get all parcels (paginated)', description: 'Returns a paginated list of all land parcels with centroids.' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 50 })
  async getAllParcels(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;
    return this.landParcelService.getAllParcels(pageNum, limitNum);
  }
}
