import { Module } from '@nestjs/common';
import { EntryPointsService } from './entry-points.service';
import { EntryPointsController } from './entry-points.controller';

@Module({
  controllers: [EntryPointsController],
  providers: [EntryPointsService],
})
export class EntryPointsModule {}
