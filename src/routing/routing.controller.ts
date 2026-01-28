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
import { RoutingService } from './routing.service';
import { MapboxService } from './mapbox.service';
import {
  CalculateRouteDto,
  AlternativeRoutesDto,
  TransportMode,
} from './dto/routing.dto';
import { RouteResponse } from './types/route.types';

@Controller('routing')
export class RoutingController {
  constructor(
    private readonly routingService: RoutingService,
    private readonly mapboxService: MapboxService,
  ) {}

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  async calculateRoute(
    @Body(ValidationPipe) dto: CalculateRouteDto,
  ): Promise<RouteResponse> {
    return this.routingService.calculateRoute(dto);
  }

  @Post('alternatives')
  @HttpCode(HttpStatus.OK)
  async getAlternativeRoutes(
    @Body(ValidationPipe) dto: AlternativeRoutesDto,
  ): Promise<RouteResponse[]> {
    return this.routingService.getAlternativeRoutes(dto);
  }

  @Get('road-name')
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
  async checkHealth() {
    try {
      const testRoute = await this.mapboxService.getRoute(
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
