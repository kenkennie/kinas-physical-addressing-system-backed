import { Controller } from '@nestjs/common';
import { EntryPointsService } from './entry-points.service';

@Controller('entry-points')
export class EntryPointsController {
  constructor(private readonly entryPointsService: EntryPointsService) {}
}
