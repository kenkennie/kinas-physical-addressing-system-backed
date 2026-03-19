import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdministrativeBlockService } from './administrative-block.service';

@ApiTags('administrative-block')
@Controller('administrative-block')
export class AdministrativeBlockController {
  constructor(
    private readonly administrativeBlockService: AdministrativeBlockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all administrative blocks (paginated)', description: 'Returns all administrative blocks ordered by county, constituency and name.' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.administrativeBlockService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Search administrative blocks', description: 'Search by block name, constituency or county name.' })
  @ApiQuery({ name: 'q', description: 'Search query', example: 'nairobi' })
  async search(@Query('q') q: string) {
    return this.administrativeBlockService.search(q);
  }

  @Get('at-point')
  @ApiOperation({ summary: 'Find administrative block at coordinates', description: 'Returns the administrative block that contains the given coordinates.' })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: -1.2868 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: 36.8249 })
  async findAtPoint(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.administrativeBlockService.findAtPoint(
      parseFloat(lat),
      parseFloat(lng),
    );
  }

  @Get('counties')
  @ApiOperation({ summary: 'Get all counties', description: 'Returns all counties with their administrative block counts.' })
  async getCounties() {
    return this.administrativeBlockService.getCounties();
  }

  @Get('constituencies')
  @ApiOperation({ summary: 'Get all constituencies', description: 'Returns all constituencies with block counts. Optionally filter by county.' })
  @ApiQuery({ name: 'county', required: false, description: 'Filter by county name', example: 'NAIROBI' })
  async getConstituencies(@Query('county') county?: string) {
    return this.administrativeBlockService.getConstituencies(county);
  }

  @Get('county/:countyName')
  @ApiOperation({ summary: 'Get blocks by county', description: 'Returns all administrative blocks in the given county.' })
  @ApiParam({ name: 'countyName', description: 'County name', example: 'NAIROBI' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  async findByCounty(
    @Param('countyName') countyName: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.administrativeBlockService.findByCounty(
      countyName,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  @Get('constituency/:constituencyName')
  @ApiOperation({ summary: 'Get blocks by constituency', description: 'Returns all administrative blocks in the given constituency.' })
  @ApiParam({ name: 'constituencyName', description: 'Constituency name', example: 'STAREHE' })
  async findByConstituency(
    @Param('constituencyName') constituencyName: string,
  ) {
    return this.administrativeBlockService.findByConstituency(constituencyName);
  }

  @Get(':gid')
  @ApiOperation({ summary: 'Get administrative block by GID', description: 'Returns full block details including GeoJSON geometry and centroid.' })
  @ApiParam({ name: 'gid', description: 'Administrative block GID', example: 1 })
  async findOne(@Param('gid') gid: string) {
    return this.administrativeBlockService.findOne(parseInt(gid));
  }
}
