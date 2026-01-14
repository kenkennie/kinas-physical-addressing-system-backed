import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { EntryPoint } from '../entry-points/entities/entry-point.entity';
import { AdministrativeBlock } from '../administrative-block/entities/administrative-block.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LandParcel, EntryPoint, AdministrativeBlock]),
  ],
  controllers: [AddressController],
  providers: [AddressService],
  exports: [AddressService],
})
export class AddressModule {}
