import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdministrativeBlock } from './entities/administrative-block.entity';

@Injectable()
export class AdministrativeBlockService {
  constructor(
    @InjectRepository(AdministrativeBlock)
    private readonly blockRepo: Repository<AdministrativeBlock>,
  ) {}

  async findAll(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [blocks, total] = await Promise.all([
      this.blockRepo.query(
        `SELECT gid, const_code, objectid, objectid_2, name, constituen, county_nam, short_name,
                CAST(shape_area AS FLOAT) as shape_area
         FROM administrative_block
         ORDER BY county_nam, constituen, name
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.blockRepo.query(`SELECT COUNT(*) as count FROM administrative_block`),
    ]);

    return {
      data: blocks,
      pagination: {
        page,
        limit,
        total: parseInt(total[0].count),
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }

  async findOne(gid: number) {
    const result = await this.blockRepo.query(
      `SELECT gid, const_code, objectid, objectid_2, name, constituen, county_nam, short_name,
              CAST(shape_area AS FLOAT) as shape_area,
              ST_AsGeoJSON(geom)::json as geometry,
              json_build_object(
                'lat', ST_Y(ST_Centroid(geom)),
                'lng', ST_X(ST_Centroid(geom))
              ) as centroid
       FROM administrative_block
       WHERE gid = $1`,
      [gid],
    );

    if (!result[0]) throw new NotFoundException(`Administrative block with GID ${gid} not found`);
    return result[0];
  }

  async findByCounty(countyName: string, page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;

    const [blocks, total] = await Promise.all([
      this.blockRepo.query(
        `SELECT gid, const_code, name, constituen, county_nam, short_name,
                CAST(shape_area AS FLOAT) as shape_area
         FROM administrative_block
         WHERE county_nam ILIKE $1
         ORDER BY constituen, name
         LIMIT $2 OFFSET $3`,
        [`%${countyName}%`, limit, offset],
      ),
      this.blockRepo.query(
        `SELECT COUNT(*) as count FROM administrative_block WHERE county_nam ILIKE $1`,
        [`%${countyName}%`],
      ),
    ]);

    return {
      data: blocks,
      pagination: {
        page,
        limit,
        total: parseInt(total[0].count),
        totalPages: Math.ceil(total[0].count / limit),
      },
    };
  }

  async findByConstituency(constituencyName: string) {
    return this.blockRepo.query(
      `SELECT gid, const_code, name, constituen, county_nam, short_name,
              CAST(shape_area AS FLOAT) as shape_area
       FROM administrative_block
       WHERE constituen ILIKE $1
       ORDER BY name`,
      [`%${constituencyName}%`],
    );
  }

  async search(query: string) {
    return this.blockRepo.query(
      `SELECT gid, const_code, name, constituen, county_nam, short_name,
              CAST(shape_area AS FLOAT) as shape_area
       FROM administrative_block
       WHERE name ILIKE $1 OR constituen ILIKE $1 OR county_nam ILIKE $1
       ORDER BY county_nam, constituen, name
       LIMIT 20`,
      [`%${query}%`],
    );
  }

  async findAtPoint(lat: number, lng: number) {
    const result = await this.blockRepo.query(
      `SELECT gid, const_code, name, constituen, county_nam, short_name,
              CAST(shape_area AS FLOAT) as shape_area
       FROM administrative_block
       WHERE ST_Intersects(geom, ST_SetSRID(ST_MakePoint($2, $1), 4326))
       LIMIT 1`,
      [lat, lng],
    );

    if (!result[0]) throw new NotFoundException('No administrative block found at this location');
    return result[0];
  }

  async getCounties() {
    return this.blockRepo.query(
      `SELECT county_nam, COUNT(*) as block_count
       FROM administrative_block
       GROUP BY county_nam
       ORDER BY county_nam`,
    );
  }

  async getConstituencies(countyName?: string) {
    const params: any[] = [];
    let whereClause = '';

    if (countyName) {
      params.push(`%${countyName}%`);
      whereClause = `WHERE county_nam ILIKE $1`;
    }

    return this.blockRepo.query(
      `SELECT DISTINCT constituen, county_nam, COUNT(*) as block_count
       FROM administrative_block
       ${whereClause}
       GROUP BY constituen, county_nam
       ORDER BY county_nam, constituen`,
      params,
    );
  }
}
