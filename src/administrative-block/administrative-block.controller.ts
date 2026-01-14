import { Controller } from '@nestjs/common';
import { AdministrativeBlockService } from './administrative-block.service';

@Controller('administrative-block')
export class AdministrativeBlockController {
  constructor(
    private readonly administrativeBlockService: AdministrativeBlockService,
  ) {}
}
