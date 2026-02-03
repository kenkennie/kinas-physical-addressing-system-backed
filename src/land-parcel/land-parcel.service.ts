import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandParcel } from './entities/land-parcel.entity';
import { AddressService } from '../address/address.service';
import { SearchAddressDto } from './dto/searchDto';

@Injectable()
export class LandParcelService {
  constructor(
    @InjectRepository(LandParcel)
    private readonly parcelRepo: Repository<LandParcel>,
    private readonly addressService: AddressService,
  ) {}

  // Function to generate land parcel tiles with administrative data
  async generateTile(z: number, x: number, y: number) {
    try {
      const result = await this.parcelRepo.query(
        `WITH bounds AS (
         SELECT ST_TileEnvelope($1, $2, $3) AS geom
       ),
       mvtgeom AS (
         SELECT 
           ST_AsMVTGeom(
             ST_Transform(p.geom, 3857), 
             bounds.geom,
             4096, 
             256, 
             true
           ) AS geom,
           p.gid,
           p.lr_no,
           p.area,
           a.short_name,
        -- logic: Take "short_name" + "/" + everything after the first slash in "lr_no"
        CONCAT(COALESCE(a.short_name, 'UNK'), '/', SPLIT_PART(p.lr_no, '/', 2)) AS display_label
         FROM land_parcel p
         JOIN bounds ON ST_Intersects(ST_Transform(p.geom, 3857), bounds.geom)
         LEFT JOIN LATERAL (
           SELECT short_name 
           FROM administrative_block ab 
           WHERE ST_Intersects(p.geom, ab.geom) 
           LIMIT 1
         ) a ON true
       )
       SELECT ST_AsMVT(mvtgeom.*, 'parcels', 4096, 'geom') AS tile
       FROM mvtgeom`,
        [z, x, y],
      );

      // FIXED: TypeORM returns the array directly. No ".rows" needed.
      if (result && result.length > 0) {
        return result[0].tile || Buffer.alloc(0);
      }

      return Buffer.alloc(0);
    } catch (error) {
      console.error('Error generating tile:', error);
      return Buffer.alloc(0);
    }
  }

  async getParcelDetailsByLatLng(lat: number, lng: number) {
    const gid = await this.resolveParcelGidByLatLng(lat, lng);
    return this.getParcelContextByGid(gid);
  }

  private async resolveParcelGidByLatLng(
    lat: number,
    lng: number,
  ): Promise<number> {
    const result = await this.parcelRepo.query(
      `
    SELECT gid
    FROM land_parcel
    WHERE ST_Intersects(
      geom,
      ST_Buffer(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        1
      )::geometry
    )
    LIMIT 1;
    `,
      [lng, lat],
    );

    if (!result[0]) {
      throw new NotFoundException('No parcel found at this location');
    }

    return result[0].gid;
  }

  public async getParcelContextByGid(gid: number) {
    const result = await this.parcelRepo.query(
      `
    WITH parcel_info AS (
      SELECT
        gid,
        lr_no,
        fr_no,
        CAST(area AS FLOAT) AS area,
        entity,
        geom,
        ST_Y(ST_Centroid(geom)) AS centroid_lat,
        ST_X(ST_Centroid(geom)) AS centroid_lng
      FROM land_parcel
      WHERE gid = $1
      LIMIT 1
    ),

    parcel_entries AS (
      SELECT
        e.gid,
        e.label,
        e.geom,
        ST_Y(e.geom) AS lat,
        ST_X(e.geom) AS lng,
        ROUND(ST_Distance(e.geom::geography, p.geom::geography)::numeric, 2) AS distance_to_parcel
      FROM entry_points e
      CROSS JOIN parcel_info p
      WHERE ST_DWithin(e.geom::geography, p.geom::geography, 5)
      ORDER BY ST_Distance(e.geom::geography, p.geom::geography)
    ),

    entry_roads AS (
      SELECT
        pe.gid AS entry_gid,
        r.gid AS road_gid,
        r.name,
        r.fclass,
        r.ref,
        ROUND(ST_Distance(r.geom::geography, pe.geom::geography)::numeric, 2) AS distance_meters,
        ROW_NUMBER() OVER (
          PARTITION BY pe.gid
          ORDER BY ST_Distance(r.geom::geography, pe.geom::geography)
        ) rn
      FROM parcel_entries pe
      JOIN roads r
        ON ST_DWithin(r.geom::geography, pe.geom::geography, 50)
    ),

    admin_block AS (
      SELECT a.gid, a.name, a.constituen, a.county_nam, a.short_name
      FROM administrative_block a, parcel_info p
      WHERE ST_Intersects(a.geom, p.geom)
      LIMIT 1
    )

    SELECT jsonb_build_object(
      'parcel', jsonb_build_object(
        'gid', p.gid,
        'lr_no', p.lr_no,
        'fr_no', p.fr_no,
        'area', p.area,
        'entity', p.entity,
        'centroid', jsonb_build_object(
          'lat', p.centroid_lat,
          'lng', p.centroid_lng
        )
      ),
      'administrative_block', (SELECT row_to_json(admin_block.*) FROM admin_block),
      'entry_points', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'gid', pe.gid,
            'label', pe.label,
            'coordinates', jsonb_build_object('lat', pe.lat, 'lng', pe.lng),
            'distance_to_parcel_meters', pe.distance_to_parcel,
            'nearest_roads', (
              SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                  'gid', er.road_gid,
                  'name', er.name,
                  'fclass', er.fclass,
                  'ref', er.ref,
                  'distance_meters', er.distance_meters
                )
                ORDER BY er.distance_meters
              ), '[]'::jsonb)
              FROM entry_roads er
              WHERE er.entry_gid = pe.gid AND er.rn <= 3
            )
          )
        ), '[]'::jsonb)
        FROM parcel_entries pe
      )
    ) AS result
    FROM parcel_info p;
    `,
      [gid],
    );

    return result[0]?.result;
  }

  async searchAddress(searchDto: SearchAddressDto) {
    const { lr_no, physical_address, lat, lng, radius = 1000 } = searchDto;

    // Build the WHERE clause dynamically
    let whereConditions: string[] = [];
    let parameters: any[] = [];
    let paramIndex = 1;

    // Search by LR number (partial match, case-insensitive)
    if (lr_no) {
      whereConditions.push(`lp.lr_no ILIKE $${paramIndex}`);
      parameters.push(`%${lr_no}%`);
      paramIndex++;
    }

    // Search by physical address (if you have this field)
    if (physical_address) {
      whereConditions.push(
        `(ab.name ILIKE $${paramIndex} OR ab.constituen ILIKE $${paramIndex} OR ab.county_nam ILIKE $${paramIndex})`,
      );
      parameters.push(`%${physical_address}%`);
      paramIndex++;
    }

    // Search by location with radius
    if (lat && lng && radius) {
      whereConditions.push(
        `ST_DWithin(
          lp.geom::geography,
          ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex + 1}), 4326)::geography,
          $${paramIndex + 2}
        )`,
      );
      parameters.push(lng, lat, radius);
      paramIndex += 3;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const query = `
      WITH parcel_search AS (
        SELECT
          lp.gid,
          lp.lr_no,
          lp.fr_no,
          CAST(lp.area AS FLOAT) AS area,
          lp.entity,
          lp.geom,
          ST_Y(ST_Centroid(lp.geom)) AS centroid_lat,
          ST_X(ST_Centroid(lp.geom)) AS centroid_lng,
          ab.gid AS admin_gid,
          ab.name AS admin_name,
          ab.constituen AS admin_constituen,
          ab.county_nam AS admin_county,
          ab.short_name AS admin_short_name
        FROM land_parcel lp
        LEFT JOIN administrative_block ab ON ST_Intersects(ab.geom, lp.geom)
        ${whereClause}
        ORDER BY 
          CASE 
            WHEN lp.lr_no ILIKE $${parameters.length + 1} THEN 0
            ELSE 1
          END,
          lp.gid
        LIMIT 20
      ),

      parcel_entries AS (
        SELECT
          ps.gid AS parcel_gid,
          e.gid AS entry_gid,
          e.label AS entry_label,
          ST_Y(e.geom) AS entry_lat,
          ST_X(e.geom) AS entry_lng,
          ROUND(ST_Distance(e.geom::geography, ps.geom::geography)::numeric, 2) AS distance_to_parcel,
          ROW_NUMBER() OVER (
            PARTITION BY ps.gid
            ORDER BY ST_Distance(e.geom::geography, ps.geom::geography)
          ) AS rn
        FROM parcel_search ps
        LEFT JOIN entry_points e ON ST_DWithin(e.geom::geography, ps.geom::geography, 50)
      ),

      entry_roads AS (
        SELECT
          pe.entry_gid,
          r.gid AS road_gid,
          r.name AS road_name,
          r.fclass AS road_fclass,
          r.ref AS road_ref,
          ROUND(ST_Distance(r.geom::geography, pe.geom::geography)::numeric, 2) AS distance_meters,
          ROW_NUMBER() OVER (
            PARTITION BY pe.entry_gid
            ORDER BY ST_Distance(r.geom::geography, pe.geom::geography)
          ) AS road_rn
        FROM (
          SELECT entry_gid, ST_SetSRID(ST_MakePoint(entry_lng, entry_lat), 4326) as geom
          FROM parcel_entries
          WHERE rn <= 3
        ) pe
        LEFT JOIN roads r ON ST_DWithin(r.geom::geography, pe.geom::geography, 100)
      )

      SELECT
        json_build_object(
          'parcel', json_build_object(
            'gid', ps.gid,
            'lr_no', ps.lr_no,
            'fr_no', ps.fr_no,
            'area', ps.area,
            'entity', ps.entity
          ),
          'latlng', json_build_object(
            'lat', ps.centroid_lat,
            'lng', ps.centroid_lng
          ),
          'centroid', json_build_object(
            'lat', ps.centroid_lat,
            'lng', ps.centroid_lng
          ),
          'administrative_block', CASE
            WHEN ps.admin_gid IS NOT NULL THEN
              json_build_object(
                'gid', ps.admin_gid,
                'name', ps.admin_name,
                'constituen', ps.admin_constituen,
                'county_nam', ps.admin_county,
                'short_name', ps.admin_short_name
              )
            ELSE NULL
          END,
          'entry_points', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'gid', pe.entry_gid,
                  'label', pe.entry_label,
                  'coordinates', json_build_object(
                    'lat', pe.entry_lat,
                    'lng', pe.entry_lng
                  ),
                  'distance_to_parcel_meters', pe.distance_to_parcel,
                  'nearest_roads', COALESCE(
                    (
                      SELECT json_agg(
                        json_build_object(
                          'gid', er.road_gid,
                          'name', er.road_name,
                          'fclass', er.road_fclass,
                          'ref', er.road_ref,
                          'distance_meters', er.distance_meters
                        )
                        ORDER BY er.distance_meters
                      )
                      FROM entry_roads er
                      WHERE er.entry_gid = pe.entry_gid AND er.road_rn <= 3
                    ),
                    '[]'::json
                  )
                )
              )
              FROM parcel_entries pe
              WHERE pe.parcel_gid = ps.gid AND pe.rn <= 3
            ),
            '[]'::json
          ),
          'nearby_roads', '[]'::json
        ) AS result
      FROM parcel_search ps
    `;

    // Add the exact match parameter for ordering
    parameters.push(lr_no ? `${lr_no}%` : '');

    const results = await this.parcelRepo.query(query, parameters);
    return results.map((row) => row.result);
  }

  // FILE PATH: backend/src/services/parcel.service.ts

  /**
   * Get rich search suggestions with parcel details + GID
   * The GID allows us to skip searchAddress and go straight to getParcelContextByGid
   * when the user taps a suggestion.
   */
  async getSuggestions(
    query: string,
    limit: number = 5,
  ): Promise<
    Array<{
      gid: number; // ← ADDED: for fast direct lookup
      lr_no: string;
      short_name: string | null;
      area: number;
      constituency: string | null;
    }>
  > {
    if (!query || query.length < 2) {
      return [];
    }

    const results = await this.parcelRepo.query(
      `
    SELECT 
      p.gid,                -- ← ADDED
      p.lr_no,
      p.area,
      a.short_name,
      a.constituen AS constituency,
      CASE WHEN p.lr_no ILIKE $2 THEN 0 ELSE 1 END AS priority
    FROM land_parcel p
    LEFT JOIN LATERAL (
      SELECT short_name, constituen
      FROM administrative_block ab
      WHERE ST_Intersects(p.geom, ab.geom)
      LIMIT 1
    ) a ON true
    WHERE p.lr_no ILIKE $1
    ORDER BY priority, p.lr_no
    LIMIT $3
    `,
      [`%${query}%`, `${query}%`, limit],
    );

    return results.map((row) => ({
      gid: parseInt(row.gid),
      lr_no: row.lr_no,
      short_name: row.short_name,
      area: parseFloat(row.area),
      constituency: row.constituency,
    }));
  }

  async findParcelGidAtPoint(lat: number, lng: number): Promise<number> {
    // We cast to geography to ensure accurate point-in-polygon check
    const result = await this.parcelRepo.query(
      `SELECT gid FROM land_parcel 
       WHERE ST_Intersects(
         geom::geography, 
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
       )
       LIMIT 1`,
      [lng, lat],
    );

    if (!result[0]) throw new NotFoundException('No parcel found here');
    return result[0].gid;
  }

  async getAllParcels(page: number = 1, limit: number = 50) {
    try {
      const offset = (page - 1) * limit;

      const [parcels, total] = await Promise.all([
        this.parcelRepo.query(
          `SELECT 
            gid, 
            lr_no, 
            fr_no, 
            CAST(area AS FLOAT) as area,
            json_build_object(
              'lat', CAST(ST_Y(ST_Centroid(geom)) AS FLOAT),
              'lng', CAST(ST_X(ST_Centroid(geom)) AS FLOAT)
            ) as centroid
          FROM land_parcel
          ORDER BY gid
          LIMIT $1 OFFSET $2`,
          [limit, offset],
        ),
        this.parcelRepo.query(`SELECT COUNT(*) as count FROM land_parcel`),
      ]);

      return {
        data: parcels,
        pagination: {
          page,
          limit,
          total: parseInt(total[0].count),
          totalPages: Math.ceil(total[0].count / limit),
        },
      };
    } catch (error) {
      console.error('Error fetching parcels:', error);
      throw new InternalServerErrorException('Error retrieving parcels');
    }
  }

  // Search parcels by LR number
  async searchParcelsByLrNo(lrNo: string) {
    try {
      const result = await this.parcelRepo.query(
        `SELECT 
          gid, 
          lr_no, 
          fr_no, 
          CAST(area AS FLOAT) as area,
          json_build_object(
            'lat', CAST(ST_Y(ST_Centroid(geom)) AS FLOAT),
            'lng', CAST(ST_X(ST_Centroid(geom)) AS FLOAT)
          ) as centroid
        FROM land_parcel
        WHERE lr_no ILIKE $1
        ORDER BY lr_no
        LIMIT 20`,
        [`%${lrNo}%`],
      );

      return result;
    } catch (error) {
      console.error('Error searching parcels:', error);
      throw new InternalServerErrorException('Error searching parcels');
    }
  }

  // Test 1: Check if parcel exists
  async testParcel(parcelGid: number) {
    return await this.parcelRepo.query(
      `SELECT gid, lr_no, ST_AsText(geom) as geom_text FROM land_parcel WHERE gid = $1`,
      [parcelGid],
    );
  }

  // Test 2: Check entry points distance
  async testEntryPoints(parcelGid: number) {
    return await this.parcelRepo.query(
      `SELECT 
      ep.gid,
      ep.label,
      ST_Distance(ep.geom::geography, p.geom::geography) AS distance_meters
    FROM entry_points ep, land_parcel p
    WHERE p.gid = $1
    ORDER BY ST_Distance(ep.geom::geography, p.geom::geography)
    LIMIT 10`,
      [parcelGid],
    );
  }

  // Test 3: Check admin blocks
  async testAdminBlocks_(parcelGid: number) {
    return await this.parcelRepo.query(
      `SELECT 
      ab.gid,
      ab.name,
      ST_Intersects(ab.geom, p.geom) AS intersects
    FROM administrative_block ab, land_parcel p
    WHERE p.gid = $1
   `,
      [parcelGid],
    );
  }

  async testAdminBlocks(parcelGid: number) {
    const debug = await this.parcelRepo.query(
      `WITH parcel_info AS (
      SELECT geom FROM land_parcel WHERE gid = $1
    )
    SELECT 
      'Entry Points' as test_name,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE ST_DWithin(ep.geom::geography, p.geom::geography, 50)) as within_50m,
      COUNT(*) FILTER (WHERE ST_DWithin(ep.geom::geography, p.geom::geography, 500)) as within_500m,
      MIN(ST_Distance(ep.geom::geography, p.geom::geography)) as min_distance,
      MAX(ST_Distance(ep.geom::geography, p.geom::geography)) as max_distance
    FROM entry_points ep, parcel_info p
    GROUP BY test_name
    
    UNION ALL
    
    SELECT 
      'Roads' as test_name,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE ST_DWithin(r.geom::geography, p.geom::geography, 100)) as within_100m,
      COUNT(*) FILTER (WHERE ST_DWithin(r.geom::geography, p.geom::geography, 1000)) as within_1000m,
      MIN(ST_Distance(r.geom::geography, p.geom::geography)) as min_distance,
      MAX(ST_Distance(r.geom::geography, p.geom::geography)) as max_distance
    FROM roads r, parcel_info p
    GROUP BY test_name
    
    UNION ALL
    
    SELECT 
      'Admin Blocks' as test_name,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE ST_Intersects(ab.geom, p.geom)) as intersecting,
      COUNT(*) FILTER (WHERE ST_DWithin(ab.geom::geography, p.geom::geography, 1000)) as within_1000m,
      MIN(ST_Distance(ab.geom::geography, p.geom::geography)) as min_distance,
      MAX(ST_Distance(ab.geom::geography, p.geom::geography)) as max_distance
    FROM administrative_block ab, parcel_info p
    GROUP BY test_name`,
      [parcelGid],
    );

    return debug;
  }

  // Test 4: Check roads near parcel
  async testRoads(parcelGid: number) {
    return await this.parcelRepo.query(
      `SELECT 
      r.gid,
      r.name,
      ST_Distance(r.geom::geography, p.geom::geography) AS distance_meters
    FROM roads r, land_parcel p
    WHERE p.gid = $1
    ORDER BY ST_Distance(r.geom::geography, p.geom::geography)
    LIMIT 10`,
      [parcelGid],
    );
  }
}
