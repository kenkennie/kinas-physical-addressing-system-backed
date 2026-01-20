import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandParcelService } from './land-parcel.service';
import { LandParcelController } from './land-parcel.controller';
import { LandParcel } from './entities/land-parcel.entity';
import { AddressModule } from '../address/address.module';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    AddressModule,
    TypeOrmModule.forFeature([LandParcel]),
    CacheModule.register({
      ttl: 3600, // 1 hour
      max: 1000, // max items
    }),
  ],
  controllers: [LandParcelController],
  providers: [LandParcelService],
})
export class LandParcelModule {}
