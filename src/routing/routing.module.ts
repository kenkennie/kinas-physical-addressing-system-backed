import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoutingService } from './routing.service';
import { RoutingController } from './routing.controller';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { EntryPoint } from '../entry-points/entities/entry-point.entity';
import { Road } from '../roads/entities/road.entity';
import { AddressModule } from '../address/address.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LandParcel, EntryPoint, Road]),
    AddressModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService],
})
export class RoutingModule {}
