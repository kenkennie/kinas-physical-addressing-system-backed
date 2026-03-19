import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { RoadsService } from './roads.service';

@ApiTags('roads')
@Controller('roads')
export class RoadsController {
  constructor(private readonly roadsService: RoadsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all roads (paginated)', description: 'Returns a paginated list of all roads from the OpenStreetMap Kenya dataset.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roadsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search roads by name', description: 'Search roads by name with optional road class filter.' })
  @ApiQuery({ name: 'name', description: 'Road name (partial match)', example: 'Uhuru' })
  @ApiQuery({ name: 'fclass', required: false, description: 'Road class filter e.g. secondary, residential', example: 'secondary' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async search(
    @Query('name') name: string,
    @Query('fclass') fclass?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roadsService.search(name, fclass, limit ? parseInt(limit) : 20);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find roads near a point', description: 'Returns roads within the given radius of the coordinates, ordered by distance.' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: -1.2868 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: 36.8249 })
  @ApiQuery({ name: 'radius', required: false, description: 'Search radius in meters (default 200)', example: 200 })
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.roadsService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 200,
    );
  }

  @Get('fclasses')
  @ApiOperation({ summary: 'Get road classes', description: 'Returns all road classifications with their counts e.g. primary, secondary, residential, service.' })
  async getFclasses() {
    return this.roadsService.getFclasses();
  }

  @Get('fclass/:fclass')
  @ApiOperation({ summary: 'Get roads by class', description: 'Returns all roads of a specific classification.' })
  @ApiParam({ name: 'fclass', description: 'Road class', example: 'secondary' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async getByFclass(
    @Param('fclass') fclass: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.roadsService.getByFclass(
      fclass,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get(':gid')
  @ApiOperation({ summary: 'Get road by GID', description: 'Returns full road details including GeoJSON geometry.' })
  @ApiParam({ name: 'gid', description: 'Road GID', example: 55 })
  async findOne(@Param('gid') gid: string) {
    return this.roadsService.findOne(parseInt(gid));
  }
}
