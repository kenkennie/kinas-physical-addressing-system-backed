import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { EntryPointsService } from './entry-points.service';

@ApiTags('entry-points')
@Controller('entry-points')
export class EntryPointsController {
  constructor(private readonly entryPointsService: EntryPointsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all entry points (paginated)', description: 'Returns all entry points with their coordinates in both projected and WGS84 formats.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entryPointsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find entry points near a point', description: 'Returns entry points within the given radius, ordered by distance.' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: -1.2868 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: 36.8249 })
  @ApiQuery({ name: 'radius', required: false, description: 'Search radius in meters (default 100)', example: 100 })
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    return this.entryPointsService.findNearby(
      parseFloat(lat),
      parseFloat(lng),
      radius ? parseInt(radius) : 100,
    );
  }

  @Get('parcel/:lrNo')
  @ApiOperation({ summary: 'Find entry points for a parcel', description: 'Returns all entry points within 50m of the given land parcel, ordered by proximity.' })
  @ApiParam({ name: 'lrNo', description: 'Land Register number', example: '1%2F136' })
  async findByParcel(@Param('lrNo') lrNo: string) {
    return this.entryPointsService.findByParcel(lrNo);
  }

  @Get(':gid/nearest-roads')
  @ApiOperation({ summary: 'Get nearest roads to an entry point', description: 'Returns the nearest roads to the given entry point within the specified radius.' })
  @ApiParam({ name: 'gid', description: 'Entry point GID', example: 1 })
  @ApiQuery({ name: 'radius', required: false, description: 'Search radius in meters (default 100)', example: 100 })
  async findNearestRoads(
    @Param('gid') gid: string,
    @Query('radius') radius?: string,
  ) {
    return this.entryPointsService.findNearestRoads(
      parseInt(gid),
      radius ? parseInt(radius) : 100,
    );
  }

  @Get(':gid')
  @ApiOperation({ summary: 'Get entry point by GID', description: 'Returns full entry point details including GeoJSON geometry.' })
  @ApiParam({ name: 'gid', description: 'Entry point GID', example: 1 })
  async findOne(@Param('gid') gid: string) {
    return this.entryPointsService.findOne(parseInt(gid));
  }
}
