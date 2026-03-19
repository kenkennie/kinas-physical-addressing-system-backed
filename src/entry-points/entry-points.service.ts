import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntryPoint } from './entities/entry-point.entity';

@Injectable()
export class EntryPointsService {
  constructor(
    @InjectRepository(EntryPoint)
    private readonly entryPointRepo: Repository<EntryPoint>,
  ) {}

  async findAll(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [points, total] = await Promise.all([
      this.entryPointRepo.query(
        `SELECT gid, label,
                CAST(x AS FLOAT) as x,
                CAST(y AS FLOAT) as y,
                ST_Y(geom) as lat,
                ST_X(geom) as lng
         FROM entry_points
         ORDER BY gid
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.entryPointRepo.query(`SELECT COUNT(*) as count FROM entry_points`),
    ]);

    return {
      data: points,
      pagination: {
        page,
        limit,
        total: parseInt(total[0].count),
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }

  async findOne(gid: number) {
    const result = await this.entryPointRepo.query(
      `SELECT gid, label,
              CAST(x AS FLOAT) as x,
              CAST(y AS FLOAT) as y,
              ST_Y(geom) as lat,
              ST_X(geom) as lng,
              ST_AsGeoJSON(geom)::json as geometry
       FROM entry_points
       WHERE gid = $1`,
      [gid],
    );

    if (!result[0]) throw new NotFoundException(`Entry point with GID ${gid} not found`);
    return result[0];
  }

  async findNearby(lat: number, lng: number, radiusMeters: number = 100) {
    return this.entryPointRepo.query(
      `SELECT gid, label,
              ST_Y(geom) as lat,
              ST_X(geom) as lng,
              ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::numeric, 2) AS distance_meters
       FROM entry_points
       WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       ORDER BY distance_meters
       LIMIT 20`,
      [lat, lng, radiusMeters],
    );
  }

  async findByParcel(lrNo: string) {
    return this.entryPointRepo.query(
      `SELECT ep.gid, ep.label,
              ST_Y(ep.geom) as lat,
              ST_X(ep.geom) as lng,
              ROUND(ST_Distance(ep.geom::geography, p.geom::geography)::numeric, 2) AS distance_to_parcel_meters
       FROM entry_points ep
       JOIN land_parcel p ON ST_DWithin(ep.geom::geography, p.geom::geography, 50)
       WHERE p.lr_no = $1
       ORDER BY distance_to_parcel_meters`,
      [lrNo],
    );
  }

  async findNearestRoads(gid: number, radiusMeters: number = 100) {
    const point = await this.findOne(gid);

    return this.entryPointRepo.query(
      `SELECT r.gid, r.name, r.fclass, r.ref,
              ROUND(ST_Distance(r.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::numeric, 2) AS distance_meters
       FROM roads r
       WHERE ST_DWithin(r.geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       ORDER BY distance_meters
       LIMIT 5`,
      [point.lat, point.lng, radiusMeters],
    );
  }
}

