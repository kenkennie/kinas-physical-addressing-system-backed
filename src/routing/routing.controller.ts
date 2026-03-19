// src/routing/routing.controller.ts
import {
  Controller,
  Post,
  Body,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';
import { RoutingService } from './routing.service';
import { MapboxService } from './mapbox.service';
import {
  CalculateRouteDto,
  AlternativeRoutesDto,
  TransportMode,
} from './dto/routing.dto';
import { RouteResponse } from './types/route.types';

@ApiTags('routing')
@Controller('routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly mapboxService: MapboxService,
  ) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate route to a land parcel',
    description:
      'Calculates the optimal route from origin coordinates to a land parcel identified by LR number. Resolves the best entry point and returns turn-by-turn instructions.',
  })
  @ApiBody({
    type: CalculateRouteDto,
    examples: {
      driving: {
        summary: 'Driving route',
        value: {
          origin: { lat: -1.2921, lng: 36.8219 },
          destination_lr_no: '1/136',
          mode: 'driving',
        },
      },
    },
  })
  async calculateRoute(
    @Body(ValidationPipe) dto: CalculateRouteDto,
  ): Promise<RouteResponse> {
    return this.routingService.calculateRoute(dto);
  }

  @Post('alternatives')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get alternative routes to a land parcel',
    description:
      'Returns multiple route options to a land parcel, one per available entry point, so the user can choose the most convenient access.',
  })
  @ApiBody({
    type: AlternativeRoutesDto,
    examples: {
      driving: {
        summary: 'Alternative driving routes',
        value: {
          origin: { lat: -1.2921, lng: 36.8219 },
          destination_lr_no: '1/136',
          mode: 'driving',
        },
      },
    },
  })
  async getAlternativeRoutes(
    @Body(ValidationPipe) dto: AlternativeRoutesDto,
  ): Promise<RouteResponse[]> {
    return this.routingService.getAlternativeRoutes(dto);
  }

  @Get('road-name')
  @ApiOperation({
    summary: 'Get road name at coordinates',
    description:
      'Uses Mapbox reverse geocoding to return the name of the road nearest to the given coordinates.',
  })
  @ApiQuery({ name: 'lat', description: 'Latitude', example: -1.2868 })
  @ApiQuery({ name: 'lng', description: 'Longitude', example: 36.8249 })
  async getRoadName(@Query('lat') lat: string, @Query('lng') lng: string) {
    if (!lat || !lng) {
      throw new BadRequestException('Latitude and longitude are required');
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new BadRequestException('Invalid coordinates');
    }

    const roadName = await this.mapboxService.getRoadName(latitude, longitude);

    return {
      coordinates: { lat: latitude, lng: longitude },
      road_name: roadName,
    };
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Quick route preview',
    description:
      'Returns a lightweight route summary (distance and duration) between two coordinate pairs without full turn-by-turn instructions.',
  })
  @ApiBody({
    schema: {
      example: {
        origin: { lat: -1.2921, lng: 36.8219 },
        destination: { lat: -1.2868, lng: 36.8249 },
        mode: 'driving',
      },
    },
  })
  async getRoutePreview(
    @Body(ValidationPipe)
    dto: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      mode: TransportMode;
    },
  ) {
    const mapboxRoute = await this.mapboxService.getRoute(
      dto.origin,
      dto.destination,
      dto.mode,
    );

    const primaryRoute = mapboxRoute.routes[0];

    return {
      distance: primaryRoute.distance,
      duration: primaryRoute.duration,
      mode: dto.mode,
      formatted: {
        distance: `${(primaryRoute.distance / 1000).toFixed(1)} km`,
        duration: `${Math.ceil(primaryRoute.duration / 60)} min`,
      },
    };
  }

  @Get('health')
  @ApiOperation({
    summary: 'Check Mapbox connection health',
    description:
      'Verifies the Mapbox API is reachable and the token is valid by running a test route calculation.',
  })
  async checkHealth() {
    try {
      await this.mapboxService.getRoute(
        { lat: -1.2921, lng: 36.8219 },
        { lat: -1.2864, lng: 36.8172 },
        'driving',
      );

      return {
        status: 'healthy',
        mapbox: 'connected',
        test_route_calculated: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        mapbox: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
