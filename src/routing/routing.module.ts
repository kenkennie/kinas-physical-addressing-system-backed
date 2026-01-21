// src/routing/routing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { LandParcelService } from 'src/land-parcel/land-parcel.service';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [TypeOrmModule.forFeature([LandParcel]), AddressModule],
  controllers: [RoutingController],
  providers: [RoutingService, LandParcelService],
  exports: [RoutingService],
})
export class RoutingModule {}
