import { Module } from '@nestjs/common';
import { AdministrativeBlockService } from './administrative-block.service';
import { AdministrativeBlockController } from './administrative-block.controller';

@Module({
  controllers: [AdministrativeBlockController],
  providers: [AdministrativeBlockService],
})
export class AdministrativeBlockModule {}
