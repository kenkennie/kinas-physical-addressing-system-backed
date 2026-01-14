import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandParcelService } from './land-parcel.service';
import { LandParcelController } from './land-parcel.controller';
import { LandParcel } from './entities/land-parcel.entity';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [TypeOrmModule.forFeature([LandParcel]), AddressModule],
  controllers: [LandParcelController],
  providers: [LandParcelService],
})
export class LandParcelModule {}
