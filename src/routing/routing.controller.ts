import { Body, Controller, Post } from '@nestjs/common';
import { RoutingService } from './routing.service';
import { RouteRequestDto } from './dto/routing.dto';

@Controller('routing')
export class RoutingController {
  constructor(private routingService: RoutingService) {}

  @Post('calculate')
  async calculateRoute(@Body() routeDto: RouteRequestDto) {
    return await this.routingService.calculateRoute(routeDto);
  }
}
