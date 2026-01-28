// src/routing/routing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { MapboxService } from './mapbox.service';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { EntryPoint } from '../entry-points/entities/entry-point.entity';
import { AdministrativeBlock } from '../administrative-block/entities/administrative-block.entity';
import { LandParcelService } from 'src/land-parcel/land-parcel.service';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LandParcel, EntryPoint, AdministrativeBlock]),
    AddressModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService, LandParcelService, MapboxService],
  exports: [RoutingService],
})
export class RoutingModule {}
