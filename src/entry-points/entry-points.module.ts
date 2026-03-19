import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntryPointsService } from './entry-points.service';
import { EntryPointsController } from './entry-points.controller';
import { EntryPoint } from './entities/entry-point.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EntryPoint])],
  controllers: [EntryPointsController],
  providers: [EntryPointsService],
  exports: [EntryPointsService],
})
export class EntryPointsModule {}
