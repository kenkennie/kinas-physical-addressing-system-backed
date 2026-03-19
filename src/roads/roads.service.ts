import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Road } from './entities/road.entity';

@Injectable()
export class RoadsService {
  constructor(
    @InjectRepository(Road)
    private readonly roadRepo: Repository<Road>,
  ) {}

  async findAll(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [roads, total] = await Promise.all([
      this.roadRepo.query(
        `SELECT gid, osm_id, name, fclass, ref, oneway, maxspeed, layer, bridge, tunnel,
                CAST(shape_leng AS FLOAT) as shape_leng
         FROM roads
         ORDER BY gid
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.roadRepo.query(`SELECT COUNT(*) as count FROM roads`),
    ]);

    return {
      data: roads,
      pagination: {
        page,
        limit,
        total: parseInt(total[0].count),
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }

  async findOne(gid: number) {
    const result = await this.roadRepo.query(
      `SELECT gid, osm_id, name, fclass, ref, oneway, maxspeed, layer, bridge, tunnel,
              CAST(shape_leng AS FLOAT) as shape_leng,
              ST_AsGeoJSON(geom)::json as geometry
       FROM roads
       WHERE gid = $1`,
      [gid],
    );

    if (!result[0]) throw new NotFoundException(`Road with GID ${gid} not found`);
    return result[0];
  }

  async search(name: string, fclass?: string, limit: number = 20) {
    const params: any[] = [`%${name}%`];
    let fclassClause = '';

    if (fclass) {
      params.push(fclass);
      fclassClause = `AND fclass = $${params.length}`;
    }

    params.push(limit);

    return this.roadRepo.query(
      `SELECT gid, osm_id, name, fclass, ref, oneway, maxspeed,
              CAST(shape_leng AS FLOAT) as shape_leng
       FROM roads
       WHERE name ILIKE $1 ${fclassClause}
       ORDER BY name
       LIMIT $${params.length}`,
      params,
    );
  }

  async findNearby(lat: number, lng: number, radiusMeters: number = 200) {
    return this.roadRepo.query(
      `SELECT gid, osm_id, name, fclass, ref, oneway, maxspeed,
              CAST(shape_leng AS FLOAT) as shape_leng,
              ROUND(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::numeric, 2) AS distance_meters
       FROM roads
       WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)
       ORDER BY distance_meters
       LIMIT 20`,
      [lat, lng, radiusMeters],
    );
  }

  async getByFclass(fclass: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [roads, total] = await Promise.all([
      this.roadRepo.query(
        `SELECT gid, osm_id, name, fclass, ref, oneway, maxspeed,
                CAST(shape_leng AS FLOAT) as shape_leng
         FROM roads
         WHERE fclass = $1
         ORDER BY name
         LIMIT $2 OFFSET $3`,
        [fclass, limit, offset],
      ),
      this.roadRepo.query(
        `SELECT COUNT(*) as count FROM roads WHERE fclass = $1`,
        [fclass],
      ),
    ]);

    return {
      data: roads,
      pagination: {
        page,
        limit,
        total: parseInt(total[0].count),
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }

  async getFclasses() {
    const result = await this.roadRepo.query(
      `SELECT fclass, COUNT(*) as count
       FROM roads
       GROUP BY fclass
       ORDER BY count DESC`,
    );
    return result;
  }
}
