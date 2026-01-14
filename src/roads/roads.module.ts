import { Module } from '@nestjs/common';
import { RoadsService } from './roads.service';
import { RoadsController } from './roads.controller';

@Module({
  controllers: [RoadsController],
  providers: [RoadsService],
})
export class RoadsModule {}
