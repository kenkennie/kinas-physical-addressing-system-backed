import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdministrativeBlock } from 'src/administrative-block/entities/administrative-block.entity';
import { EntryPoint } from 'src/entry-points/entities/entry-point.entity';
import { LandParcel } from 'src/land-parcel/entities/land-parcel.entity';
import { Repository } from 'typeorm';
import { AddressSearchDto } from './dto/address.dto';

@Injectable()
export class AddressService {
  constructor(
    @InjectRepository(LandParcel)
    private parcelRepo: Repository<LandParcel>,
    @InjectRepository(EntryPoint)
    private entryPointRepo: Repository<EntryPoint>,
    @InjectRepository(AdministrativeBlock)
    private adminBlockRepo: Repository<AdministrativeBlock>,
  ) {}

  async searchAddress(searchDto: AddressSearchDto) {
    const query = this.parcelRepo.createQueryBuilder('p');

    if (searchDto.lr_no) {
      query.andWhere('p.lr_no ILIKE :lr_no', { lr_no: `%${searchDto.lr_no}%` });
    }

    if (searchDto.fr_no) {
      query.andWhere('p.fr_no ILIKE :fr_no', { fr_no: `%${searchDto.fr_no}%` });
    }

    // if (searchDto.physical_address) {
    //   query.andWhere('p.physical_address ILIKE :addr', {
    //     addr: `%${searchDto.physical_address}%`,
    //   });
    // }

    if (searchDto.lat && searchDto.lng) {
      const radius = searchDto.radius || 1000;
      query.andWhere(
        `ST_DWithin(
          p.geom::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
        { lat: searchDto.lat, lng: searchDto.lng, radius },
      );
    }

    const parcels = await query.limit(50).getMany();

    const results = await Promise.all(
      parcels.map(async (parcel) => {
        const entryPoints = await this.getParcelEntryPoints(parcel.lr_no);
        const nearbyRoads = await this.getNearbyRoads(parcel.gid);
        const adminBlock = await this.getAdminBlock(parcel.gid);
        const centroid = await this.getParcelCentroid(parcel.gid);

        return {
          parcel,
          entry_points: entryPoints,
          nearby_roads: nearbyRoads,
          administrative_block: adminBlock,
          centroid,
        };
      }),
    );
    return results;
  }

  async getParcelDetails(lr_no: string) {
    const parcel = await this.parcelRepo.findOne({ where: { lr_no } });

    if (!parcel) {
      throw new Error('Parcel not found');
    }

    const entryPoints = await this.getParcelEntryPoints(parcel.lr_no);
    const nearbyRoads = await this.getNearbyRoads(parcel.gid);
    const adminBlock = await this.getAdminBlock(parcel.gid);
    const centroid = await this.getParcelCentroid(parcel.gid);

    return {
      parcel,
      entry_points: entryPoints,
      nearby_roads: nearbyRoads,
      administrative_block: adminBlock,
      centroid,
    };
  }

  // private async getParcelEntryPoints(parcel_gid: number) {
  //   return this.entryPointRepo
  //     .createQueryBuilder('ep')
  //     .leftJoin(LandParcel, 'p', 'p.gid = :gid', { gid: parcel_gid })
  //     .where(
  //       'ST_Intersects(ST_Buffer(p.geom::geography, 50)::geometry, ep.geom)',
  //     )
  //     .orderBy('ep.label', 'ASC')
  //     .getMany();
  // }

  private async getParcelEntryPoints(lr_no: string) {
    const result = await this.entryPointRepo.query(
      `SELECT 
      ep.gid, 
      ep.label,
      ST_X(ep.geom) as x,  -- Still return original
      ST_Y(ep.geom) as y,  -- Still return original
      ST_X(ST_Transform(ep.geom, 4326)) as lng,  -- Add converted  longitude
      ST_Y(ST_Transform(ep.geom, 4326)) as lat   -- Add converted latitude
    FROM entry_points ep, land_parcel p
    WHERE p.lr_no = $1
      AND ST_DWithin(
        p.geom::geography, 
        ep.geom::geography, 
        50
      )
    ORDER BY ep.label ASC`,
      [lr_no],
    );

    return result;
  }

  private async getNearbyRoads(parcel_gid: number) {
    const roads = await this.parcelRepo.query(
      `SELECT r.gid, r.name, r.ref, r.fclass, 
             ST_Distance(r.geom::geography, p.geom::geography) as distance
      FROM roads r, land_parcel p
      WHERE p.gid = $1
        AND ST_DWithin(r.geom::geography, p.geom::geography, 50)
      ORDER BY distance ASC
      LIMIT 5
    `,
      [parcel_gid],
    );

    return roads;
  }

  private async getAdminBlock(parcel_gid: number) {
    const result = await this.parcelRepo.query(
      `
      SELECT ab.*
      FROM administrative_block ab, land_parcel p
      WHERE p.gid = $1
        AND ST_Intersects(ab.geom, p.geom)
      LIMIT 1
    `,
      [parcel_gid],
    );

    return result[0] || null;
  }

  private async getParcelCentroid(parcel_gid: number) {
    const result = await this.parcelRepo.query(
      `
      SELECT ST_Y(ST_Centroid(geom)) as lat, ST_X(ST_Centroid(geom)) as lng
      FROM land_parcel
      WHERE gid = $1
    `,
      [parcel_gid],
    );

    return result[0];
  }
}
