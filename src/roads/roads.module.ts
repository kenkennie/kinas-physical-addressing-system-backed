import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadsService } from './roads.service';
import { RoadsController } from './roads.controller';
import { Road } from './entities/road.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Road])],
  controllers: [RoadsController],
  providers: [RoadsService],
  exports: [RoadsService],
})
export class RoadsModule {}
