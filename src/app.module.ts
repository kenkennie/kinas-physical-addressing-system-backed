import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EntryPointsModule } from './entry-points/entry-points.module';
import { AdministrativeBlockModule } from './administrative-block/administrative-block.module';
import { LandParcelModule } from './land-parcel/land-parcel.module';
import { RoadsModule } from './roads/roads.module';
import { AddressModule } from './address/address.module';
import { RoutingModule } from './routing/routing.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: databaseConfig,
      inject: [ConfigService],
    }),
    EntryPointsModule,
    AdministrativeBlockModule,
    LandParcelModule,
    RoadsModule,
    AddressModule,
    RoutingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
