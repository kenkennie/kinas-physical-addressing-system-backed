import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandParcel } from './entities/land-parcel.entity';
import { AddressService } from '../address/address.service';

@Injectable()
export class LandParcelService {
  constructor(
    @InjectRepository(LandParcel)
    private readonly parcelRepo: Repository<LandParcel>,
    private readonly addressService: AddressService,
  ) {}

  async generateTile(z: number, x: number, y: number) {
    const result = await this.parcelRepo.query(
      `WITH bounds AS (
      SELECT ST_TileEnvelope($1, $2, $3) AS geom
    ),
    mvtgeom AS (
      SELECT 
        ST_AsMVTGeom(
          -- Transform from EPSG:4326 to EPSG:3857 (Web Mercator)
          ST_Transform(p.geom, 3857), 
          bounds.geom,
          4096,
          256,
          true
        ) AS geom,
        p.gid,
        p.lr_no,
        p.fr_no,
        p.area,
        p.objectid,
        p.entity
      FROM land_parcel p, bounds
      WHERE ST_Intersects(
        -- Transform geometry for intersection test
        ST_Transform(p.geom, 3857),
        bounds.geom
      )
    )
    SELECT ST_AsMVT(mvtgeom.*, 'parcels', 4096, 'geom') AS tile
    FROM mvtgeom
    WHERE geom IS NOT NULL`,
      [z, x, y],
    );

    return result[0]?.tile || Buffer.alloc(0);
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

  async getParcelDetailsByLatLng(lat: number, lng: number) {
    try {
      /* ----------------------------------------------------
       * 1. Find parcel at click point (with small buffer)
       * -------------------------------------------------- */
      const parcelResult = await this.parcelRepo.query(
        `
          SELECT gid, lr_no, ST_AsText(geom) as geom_text
          FROM land_parcel
          WHERE ST_Intersects(
            geom,
            ST_Buffer(
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              1  -- 1 meter tolerance
            )::geometry
          )
          LIMIT 1;
          `,
        [lng, lat],
      );

      if (!parcelResult[0]) {
        throw new NotFoundException('No parcel found at this location');
      }

      const gid = parcelResult[0].gid;

      /* ----------------------------------------------------
       * 2. Parcel details + centroid
       * -------------------------------------------------- */
      const parcelData = await this.parcelRepo.query(
        `
        SELECT
          gid,
          lr_no,
          fr_no,
          CAST(area AS FLOAT) AS area,
          entity,
          ST_AsGeoJSON(geom) AS geometry,
          ST_Y(ST_Centroid(geom)) AS centroid_lat,
          ST_X(ST_Centroid(geom)) AS centroid_lng
        FROM land_parcel
        WHERE gid = $1;
        `,
        [gid],
      );

      /* ----------------------------------------------------
       * 3. Administrative block
       * -------------------------------------------------- */
      let adminResult = await this.parcelRepo.query(
        `
        SELECT 
          a.gid,
          a.name, 
          a.constituen, 
          a.county_nam
        FROM administrative_block a, land_parcel p
        WHERE p.gid = $1
          AND ST_Intersects(a.geom, p.geom)
        LIMIT 1;
        `,
        [gid],
      );

      // If no intersection, find nearest admin block
      if (!adminResult[0]) {
        adminResult = await this.parcelRepo.query(
          `
          SELECT 
            a.gid,
            a.name, 
            a.constituen, 
            a.county_nam,
            CAST(ROUND(ST_Distance(a.geom::geography, p.geom::geography)::numeric, 2) AS FLOAT) as distance_meters
          FROM administrative_block a, land_parcel p
          WHERE p.gid = $1
          ORDER BY a.geom <-> p.geom
          LIMIT 1;
          `,
          [gid],
        );
      }

      /* ----------------------------------------------------
       * 4. Entry points WITH their nearest roads
       * -------------------------------------------------- */
      const entryPointsWithRoads = await this.parcelRepo.query(
        `
        WITH parcel_entries AS (
          -- Find entry points within or near the parcel
          SELECT
            e.gid,
            e.label,
            e.geom,
            ST_Y(e.geom) AS lat,
            ST_X(e.geom) AS lng,
            CAST(ROUND(ST_Distance(e.geom::geography, p.geom::geography)::numeric, 2) AS FLOAT) AS distance_to_parcel
          FROM entry_points e
          CROSS JOIN land_parcel p
          WHERE p.gid = $1
            AND ST_DWithin(e.geom::geography, p.geom::geography, 5) -- within 5m
          ORDER BY ST_Distance(e.geom::geography, p.geom::geography)
        ),
        entry_roads AS (
          -- For each entry point, find closest roads
          SELECT
            pe.gid as entry_gid,
            pe.label,
            pe.lat,
            pe.lng,
            pe.distance_to_parcel,
            r.gid as road_gid,
            r.name as road_name,
            r.fclass as road_class,
            r.ref as road_ref,
            CAST(ROUND(ST_Distance(r.geom::geography, pe.geom::geography)::numeric, 2) AS FLOAT) as distance_to_road,
            ROW_NUMBER() OVER (
              PARTITION BY pe.gid 
              ORDER BY ST_Distance(r.geom::geography, pe.geom::geography)
            ) as rn
          FROM parcel_entries pe
          CROSS JOIN roads r
          WHERE r.name IS NOT NULL
            AND ST_DWithin(r.geom::geography, pe.geom::geography, 50) -- roads within 0m of entry
        )
        SELECT
          entry_gid,
          label,
          lat,
          lng,
          distance_to_parcel,
          jsonb_agg(
            jsonb_build_object(
              'gid', road_gid,
              'name', road_name,
              'fclass', road_class,
              'ref', road_ref,
              'distance_meters', distance_to_road
            )
            ORDER BY distance_to_road
          ) as nearest_roads
        FROM entry_roads
        WHERE rn <= 3  -- Top 3 closest roads per entry point
        GROUP BY entry_gid, label, lat, lng, distance_to_parcel
        ORDER BY distance_to_parcel;
        `,
        [gid],
      );

      /* ----------------------------------------------------
       * 5. Final response
       * -------------------------------------------------- */
      const response = {
        parcel: {
          gid: parcelData[0].gid,
          lr_no: parcelData[0].lr_no,
          fr_no: parcelData[0].fr_no,
          area: parcelData[0].area,
          entity: parcelData[0].entity,
          centroid: {
            lat: parcelData[0].centroid_lat,
            lng: parcelData[0].centroid_lng,
          },
          geometry: JSON.parse(parcelData[0].geometry),
        },
        administrative_block: adminResult[0] || null,
        entry_points: entryPointsWithRoads.map((ep) => ({
          gid: ep.entry_gid,
          label: ep.label,
          coordinates: {
            lat: ep.lat,
            lng: ep.lng,
          },
          distance_to_parcel_meters: ep.distance_to_parcel,
          nearest_roads: ep.nearest_roads,
        })),
      };

      console.log('API Response:', JSON.stringify(response, null, 2));

      return response;
    } catch (err) {
      console.error('Spatial Query Error:', err);
      throw new InternalServerErrorException(
        'Spatial data error: ' + err.message,
      );
    }
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
