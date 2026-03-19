import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeBlockService } from './administrative-block.service';
import { AdministrativeBlockController } from './administrative-block.controller';
import { AdministrativeBlock } from './entities/administrative-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdministrativeBlock])],
  controllers: [AdministrativeBlockController],
  providers: [AdministrativeBlockService],
  exports: [AdministrativeBlockService],
})
export class AdministrativeBlockModule {}
