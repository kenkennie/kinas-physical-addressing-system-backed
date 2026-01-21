// src/routing/routing.controller.ts
import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { CalculateRouteDto, AlternativeRoutesDto } from './dto/routing.dto';

@Controller('routing')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Post('calculate')
  async calculateRoute(@Body(ValidationPipe) dto: CalculateRouteDto) {
    return this.routingService.calculateRoute(dto);
  }

  @Post('alternatives')
  async getAlternativeRoutes(@Body(ValidationPipe) dto: AlternativeRoutesDto) {
    return this.routingService.getAlternativeRoutes(dto);
  }
}
