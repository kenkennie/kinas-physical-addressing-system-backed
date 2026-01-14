import { Controller } from '@nestjs/common';
import { RoadsService } from './roads.service';

@Controller('roads')
export class RoadsController {
  constructor(private readonly roadsService: RoadsService) {}
}
