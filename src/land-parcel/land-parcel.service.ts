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
          -- The data is ALREADY in 3857, we just need to tag it correctly
          ST_SetSRID(p.geom, 3857), 
          bounds.geom,
          4096,
          256,
          true
        ) AS geom,
        p.gid,
        p.lr_no,  -- Ensure this column exists and has data
        p.fr_no,
        p.area
      FROM land_parcel p, bounds
      WHERE ST_Intersects(
        -- Check intersection using the corrected SRID
        ST_SetSRID(p.geom, 3857),
        bounds.geom
      )
    )
    SELECT ST_AsMVT(mvtgeom.*, 'parcels') AS tile
    FROM mvtgeom`,
      [z, x, y],
    );

    return result[0]?.tile;
  }

  // async findParcelAtPoint(lat: number, lng: number) {
  //   try {
  //     // 1. Find Parcel
  //     // FIX: We apply ST_MakeValid inside the WHERE clause to prevent the crash
  //     const parcelQuery = `
  //     SELECT
  //       p.gid,
  //       p.lr_no,
  //       p.fr_no,
  //       CAST(p.area AS FLOAT) as area,
  //       p.entity,
  //       p.gid as objectid,
  //       ST_AsText(ST_MakeValid(p.geom)) as geom_text,
  //       -- BUILD THE CENTROID OBJECT FOR ZOD
  //       json_build_object(
  //         'lat', CAST(ST_Y(ST_Centroid(ST_Transform(ST_SetSRID(p.geom, 3857), 4326))) AS FLOAT),
  //         'lng', CAST(ST_X(ST_Centroid(ST_Transform(ST_SetSRID(p.geom, 3857), 4326))) AS FLOAT)
  //       ) as centroid
  //     FROM land_parcel p
  //     WHERE ST_Intersects(
  //       ST_SetSRID(ST_MakeValid(p.geom), 3857),
  //       ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
  //     )
  //     LIMIT 1
  //   `;

  //     const parcels = await this.parcelRepo.query(parcelQuery, [lng, lat]);

  //     if (!parcels[0]) throw new NotFoundException('No parcel found');

  //     const parcel = parcels[0];
  //     const parcelGeom = parcel.geom_text;

  //     // 2. Secondary Queries
  //     // FIX: Changed Entry Points to use ST_DWithin (Distance) instead of strictly Intersects
  //     const [entryPoints, roads, admin] = await Promise.all([
  //       // Find Entry points WITHIN or CLOSE TO (within 20 meters) the parcel
  //       this.parcelRepo.query(
  //         `
  //           SELECT
  //             gid,
  //             label,
  //             CAST(ST_X(ST_Transform(ST_SetSRID(geom, 3857), 4326)) AS FLOAT) as x,
  //             CAST(ST_Y(ST_Transform(ST_SetSRID(geom, 3857), 4326)) AS FLOAT) as y
  //           FROM entry_points
  //           WHERE ST_DWithin(
  //             ST_SetSRID(geom, 3857),
  //             ST_GeomFromText($1, 3857),
  //             100 -- Increased to 50 meters for testing
  //           )`,
  //         [parcelGeom],
  //       ),

  //       // Find Roads within 100 meters
  //       this.parcelRepo.query(
  //         `
  //       SELECT name, ST_Distance(ST_SetSRID(geom, 3857), ST_GeomFromText($1, 3857)) as distance
  //       FROM roads
  //       WHERE ST_DWithin(ST_SetSRID(geom, 3857), ST_GeomFromText($1, 3857), 100)
  //       ORDER BY distance ASC
  //       LIMIT 5`,
  //         [parcelGeom],
  //       ),

  //       // Find Admin Block (Fixing potential admin geometry errors too)
  //       this.parcelRepo.query(
  //         `
  //       SELECT
  //         name,
  //         constituen,
  //         county_nam -- Ensure this is selected
  //       FROM administrative_block
  //       WHERE ST_Intersects(
  //         ST_SetSRID(ST_MakeValid(geom), 3857),
  //         ST_GeomFromText($1, 3857)
  //       )
  //       LIMIT 1`,
  //         [parcelGeom],
  //       ),
  //     ]);

  //     // Remove the raw geometry text before sending to frontend
  //     delete parcel.geom_text;

  //     return {
  //       parcel: parcel,
  //       entry_points: entryPoints,
  //       nearby_roads: roads,
  //       administrative_block: admin[0] || null,
  //     };
  //   } catch (err) {
  //     console.error('Spatial Query Error:', err.message);
  //     // Return null or throw specific error based on your app needs
  //     throw new InternalServerErrorException(
  //       'Spatial data error: ' + err.message,
  //     );
  //   }
  // }

  async findParcelAtPoint(lat: number, lng: number) {
    try {
      // 1. Find the Parcel first to get its ID
      const parcelIdQuery = `
      SELECT gid 
      FROM land_parcel 
      WHERE ST_Contains(
        ST_SetSRID(ST_MakeValid(geom), 3857), 
        ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
      )
      LIMIT 1
    `;

      const initialResult = await this.parcelRepo.query(parcelIdQuery, [
        lng,
        lat,
      ]);

      if (!initialResult[0])
        throw new NotFoundException('No parcel found at this location');

      const targetGid = initialResult[0].gid;

      // 2. Run all queries using the GID for maximum precision
      const [parcelData, entryPoints, roads, admin] = await Promise.all([
        // Detailed Parcel Info
        this.parcelRepo.query(
          `
        SELECT gid, lr_no, fr_no, CAST(area AS FLOAT) as area, entity, gid as objectid,
        json_build_object(
          'lat', CAST(ST_Y(ST_Centroid(ST_Transform(ST_SetSRID(geom, 3857), 4326))) AS FLOAT),
          'lng', CAST(ST_X(ST_Centroid(ST_Transform(ST_SetSRID(geom, 3857), 4326))) AS FLOAT)
        ) as centroid
        FROM land_parcel WHERE gid = $1`,
          [targetGid],
        ),

        // Entry Points: Spatial Join with the target parcel
        // this.parcelRepo.query(
        //   `
        // SELECT
        //   e.gid,
        //   e.label,
        //   CAST(ST_X(ST_Transform(ST_SetSRID(e.geom, 3857), 4326)) AS FLOAT) as lng,
        //   CAST(ST_Y(ST_Transform(ST_SetSRID(e.geom, 3857), 4326)) AS FLOAT) as lat
        // FROM entry_points e, land_parcel p
        // WHERE p.gid = $1
        // AND ST_DWithin(ST_SetSRID(e.geom, 3857), ST_SetSRID(p.geom, 3857), 150)`,
        //   [targetGid],
        // ),

        this.parcelRepo.query(
          `
            SELECT 
              e.gid, 
              e.label, 
              CAST(ST_X(ST_Transform(ST_SetSRID(e.geom, 3857), 4326)) AS FLOAT) as x, 
              CAST(ST_Y(ST_Transform(ST_SetSRID(e.geom, 3857), 4326)) AS FLOAT) as y 
            FROM entry_points e, land_parcel p
            WHERE p.gid = $1 
            AND ST_DWithin(ST_SetSRID(e.geom, 3857), ST_SetSRID(p.geom, 3857), 150)
            `,
          [targetGid],
        ),

        // Roads: Spatial Join with the target parcel
        this.parcelRepo.query(
          `
        SELECT 
          r.name, 
          ST_Distance(ST_SetSRID(r.geom, 3857), ST_SetSRID(p.geom, 3857)) as distance 
        FROM roads r, land_parcel p
        WHERE p.gid = $1 
        AND ST_DWithin(ST_SetSRID(r.geom, 3857), ST_SetSRID(p.geom, 3857), 150)
        ORDER BY distance ASC
        LIMIT 5`,
          [targetGid],
        ),

        // Admin Block
        this.parcelRepo.query(
          `
        SELECT a.name, a.constituen, a.county_nam 
        FROM administrative_block a, land_parcel p
        WHERE p.gid = $1 
        AND ST_Intersects(ST_SetSRID(ST_MakeValid(a.geom), 3857), ST_SetSRID(p.geom, 3857))
        LIMIT 1`,
          [targetGid],
        ),
      ]);

      return {
        parcel: parcelData[0],
        entry_points: entryPoints,
        nearby_roads: roads,
        administrative_block: admin[0] || null,
      };
    } catch (err) {
      console.error('Spatial Query Error:', err.message);
      throw new InternalServerErrorException(
        'Spatial data error: ' + err.message,
      );
    }
  }
}
