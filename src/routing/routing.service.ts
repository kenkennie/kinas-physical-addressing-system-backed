// src/routing/routing.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import {
  CalculateRouteDto,
  AlternativeRoutesDto,
  TransportMode,
} from '../routing/dto/routing.dto';
import { LandParcelService } from 'src/land-parcel/land-parcel.service';

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(LandParcel)
    private readonly parcelRepo: Repository<LandParcel>,
    private readonly landParcelService: LandParcelService,
  ) {}

  /**
   * Calculate a single route to a parcel
   */
  async calculateRoute(dto: CalculateRouteDto) {
    const { origin, gid, mode, preferred_entry_point } = dto;

    // 1. Get parcel details with entry points
    const parcelData = await this.landParcelService.getParcelContextByGid(gid);

    if (parcelData.entry_points.length === 0) {
      throw new BadRequestException('Parcel has no entry points');
    }

    // 2. Select entry point
    let selectedEntry;
    if (preferred_entry_point) {
      selectedEntry = parcelData.entry_points.find(
        (ep) => ep.gid === preferred_entry_point,
      );
      if (!selectedEntry) {
        throw new NotFoundException('Specified entry point not found');
      }
    } else {
      // Find closest entry point to origin
      selectedEntry = await this.findClosestEntryPoint(
        origin,
        parcelData.entry_points,
      );
      console.log('===================selectedEntry=================');
      console.log(selectedEntry);
      console.log('===================selectedEntry=================');
    }

    // 3. Get route from origin to entry point
    const route = await this.calculateRouteToEntryPoint(
      origin,
      selectedEntry,
      mode,
    );

    // 4. Get access road for the entry point
    const accessRoad = selectedEntry.nearest_roads[0] || null;

    // 5. Generate turn-by-turn instructions
    const instructions = this.generateInstructions(
      route.segments,
      selectedEntry,
      parcelData.parcel,
      mode,
    );

    return {
      destination: {
        parcel: parcelData.parcel,
        entry_point: {
          gid: selectedEntry.gid,
          label: selectedEntry.label,
          coordinates: selectedEntry.coordinates,
          distance_to_parcel_meters: selectedEntry.distance_to_parcel_meters,
          nearest_roads: selectedEntry.nearest_roads,
        },
        access_road: accessRoad,
        physical_address: this.generatePhysicalAddress(
          parcelData.parcel,
          parcelData.administrative_block,
          accessRoad,
        ),
      },
      route: {
        segments: route.segments,
        total_distance: route.total_distance,
        mode: mode,
        entry_point: {
          lat: selectedEntry.coordinates.lat,
          lng: selectedEntry.coordinates.lng,
          label: selectedEntry.label,
        },
      },
      instructions,
    };
  }

  /**
   * Get alternative routes using different entry points
   */
  async getAlternativeRoutes(dto: AlternativeRoutesDto) {
    const { origin, destination_lr_no, mode } = dto;

    // Get parcel with all entry points
    const parcelData = await this.getParcelWithEntryPoints(destination_lr_no);

    if (!parcelData) {
      throw new NotFoundException(`Parcel ${destination_lr_no} not found`);
    }

    if (parcelData.entry_points.length === 0) {
      throw new BadRequestException('Parcel has no entry points');
    }

    // Calculate route for each entry point
    const routes = await Promise.all(
      parcelData.entry_points.map(async (entry) => {
        const route = await this.calculateRouteToEntryPoint(
          origin,
          entry,
          mode,
        );
        const accessRoad = entry.nearest_roads[0] || null;
        const instructions = this.generateInstructions(
          route.segments,
          entry,
          parcelData.parcel,
          mode,
        );

        return {
          destination: {
            parcel: parcelData.parcel,
            entry_point: {
              gid: entry.gid,
              label: entry.label,
              coordinates: entry.coordinates,
              distance_to_parcel_meters: entry.distance_to_parcel_meters,
              nearest_roads: entry.nearest_roads,
            },
            access_road: accessRoad,
            physical_address: this.generatePhysicalAddress(
              parcelData.parcel,
              parcelData.administrative_block,
              accessRoad,
            ),
          },
          route: {
            segments: route.segments,
            total_distance: route.total_distance,
            mode: mode,
            entry_point: {
              lat: entry.coordinates.lat,
              lng: entry.coordinates.lng,
              label: entry.label,
            },
          },
          instructions,
        };
      }),
    );

    // Sort by total distance (shortest first)
    return routes.sort(
      (a, b) => a.route.total_distance - b.route.total_distance,
    );
  }

  /**
   * Get parcel with entry points and admin block
   */
  private async getParcelWithEntryPoints(lr_no: string) {
    const result = await this.parcelRepo.query(
      `
      WITH parcel_info AS (
        SELECT 
          gid,
          lr_no,
          fr_no,
          CAST(area AS FLOAT) AS area,
          entity,
          geom
        FROM land_parcel
        WHERE lr_no = $1
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
        WHERE ST_DWithin(e.geom::geography, p.geom::geography, 500)
        ORDER BY ST_Distance(e.geom::geography, p.geom::geography)
      ),
      entry_roads AS (
        SELECT
          pe.gid as entry_gid,
          r.gid as road_gid,
          r.name as road_name,
          r.fclass as road_class,
          r.ref as road_ref,
          ROUND(ST_Distance(r.geom::geography, pe.geom::geography)::numeric, 2) as distance_to_road,
          ROW_NUMBER() OVER (
            PARTITION BY pe.gid 
            ORDER BY ST_Distance(r.geom::geography, pe.geom::geography)
          ) as rn
        FROM parcel_entries pe
        CROSS JOIN roads r
        WHERE r.name IS NOT NULL
          AND ST_DWithin(r.geom::geography, pe.geom::geography, 200)
      ),
      admin_block AS (
        SELECT 
          a.name, 
          a.constituen, 
          a.county_nam
        FROM administrative_block a, parcel_info p
        WHERE ST_Intersects(a.geom, p.geom)
        LIMIT 1
      )
      SELECT 
        jsonb_build_object(
          'parcel', (SELECT row_to_json(parcel_info.*) FROM parcel_info),
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
                      'name', er.road_name,
                      'fclass', er.road_class,
                      'ref', er.road_ref,
                      'distance_meters', er.distance_to_road
                    )
                    ORDER BY er.distance_to_road
                  ), '[]'::jsonb)
                  FROM entry_roads er
                  WHERE er.entry_gid = pe.gid AND er.rn <= 3
                )
              )
            ), '[]'::jsonb)
            FROM parcel_entries pe
          ),
          'administrative_block', (SELECT row_to_json(admin_block.*) FROM admin_block)
        ) as result
      `,
      [lr_no],
    );

    return result[0]?.result || null;
  }

  /**
   * Find closest entry point to origin
   */
  private async findClosestEntryPoint(origin: any, entryPoints: any[]) {
    const distances = await Promise.all(
      entryPoints.map(async (ep) => {
        const result = await this.parcelRepo.query(
          `
          SELECT ROUND(
            ST_Distance(
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
              ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
            )::numeric, 2
          ) as distance
          `,
          [origin.lng, origin.lat, ep.coordinates.lng, ep.coordinates.lat],
        );

        return { entry: ep, distance: result[0].distance };
      }),
    );

    distances.sort((a, b) => a.distance - b.distance);
    return distances[0].entry;
  }

  /**
   * Calculate route from origin to entry point using pgRouting
   */
  /**
   * Calculate route from origin to entry point using simple geometry
   */
  private async calculateRouteToEntryPoint(
    origin: any,
    entryPoint: any,
    mode: TransportMode,
  ) {
    // Get the nearest road segment to origin
    const startRoad = await this.parcelRepo.query(
      `
    SELECT 
      gid,
      name,
      fclass,
      ST_AsGeoJSON(geom) as geometry,
      ROUND(ST_Length(geom::geography)::numeric, 2) as distance,
      ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      ) as distance_to_origin
    FROM roads
    WHERE name IS NOT NULL
    ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
    LIMIT 1
    `,
      [origin.lng, origin.lat],
    );

    // Get the access road for the entry point
    const accessRoad = entryPoint.nearest_roads[0];

    if (!startRoad[0] || !accessRoad) {
      throw new BadRequestException('Cannot find route - no roads nearby');
    }

    // If start road and access road are the same, just return that road
    if (startRoad[0].gid === accessRoad.gid) {
      return {
        segments: [
          {
            gid: startRoad[0].gid,
            name: startRoad[0].name,
            road_type: startRoad[0].fclass,
            geometry: startRoad[0].geometry,
            distance: startRoad[0].distance,
            sequence: 1,
          },
        ],
        total_distance: parseFloat(startRoad[0].distance),
      };
    }

    // Otherwise, find intermediate roads
    const intermediateRoads = await this.parcelRepo.query(
      `
    WITH start_point AS (
      SELECT ST_ClosestPoint(
        geom,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      ) as point
      FROM roads
      WHERE gid = $3
    ),
    end_point AS (
      SELECT ST_Centroid(geom) as point
      FROM roads
      WHERE gid = $4
    ),
    connecting_roads AS (
      SELECT 
        r.gid,
        r.name,
        r.fclass as road_type,
        ST_AsGeoJSON(r.geom) as geometry,
        ROUND(ST_Length(r.geom::geography)::numeric, 2) as distance,
        ST_Distance(
          r.geom::geography,
          (SELECT point FROM start_point)::geography
        ) + ST_Distance(
          r.geom::geography,
          (SELECT point FROM end_point)::geography
        ) as total_distance_score
      FROM roads r
      WHERE r.name IS NOT NULL
        AND r.gid != $3
        AND r.gid != $4
        AND ST_DWithin(
          r.geom::geography,
          ST_MakeLine(
            (SELECT point FROM start_point),
            (SELECT point FROM end_point)
          )::geography,
          1000  -- Within 1km of direct line
        )
      ORDER BY total_distance_score
      LIMIT 5
    )
    SELECT * FROM connecting_roads
    ORDER BY total_distance_score
    `,
      [origin.lng, origin.lat, startRoad[0].gid, accessRoad.gid],
    );

    // Build route segments
    const segments = [
      {
        gid: startRoad[0].gid,
        name: startRoad[0].name,
        road_type: startRoad[0].fclass,
        geometry: startRoad[0].geometry,
        distance: startRoad[0].distance,
        sequence: 1,
      },
    ];

    // Add intermediate roads if any
    intermediateRoads.forEach((road, index) => {
      segments.push({
        gid: road.gid,
        name: road.name,
        road_type: road.road_type,
        geometry: road.geometry,
        distance: road.distance,
        sequence: index + 2,
      });
    });

    // Add access road
    const accessRoadData = await this.parcelRepo.query(
      `
    SELECT 
      gid,
      name,
      fclass as road_type,
      ST_AsGeoJSON(geom) as geometry,
      ROUND(ST_Length(geom::geography)::numeric, 2) as distance
    FROM roads
    WHERE gid = $1
    `,
      [accessRoad.gid],
    );

    if (accessRoadData[0]) {
      segments.push({
        gid: accessRoadData[0].gid,
        name: accessRoadData[0].name,
        road_type: accessRoadData[0].road_type,
        geometry: accessRoadData[0].geometry,
        distance: accessRoadData[0].distance,
        sequence: segments.length + 1,
      });
    }

    const totalDistance = segments.reduce(
      (sum, seg) => sum + parseFloat(seg.distance.toString()),
      0,
    );

    return {
      segments,
      total_distance: totalDistance,
    };
  }

  /**
   * Generate turn-by-turn instructions
   */
  private generateInstructions(
    segments: any[],
    entryPoint: any,
    parcel: any,
    mode: TransportMode,
  ) {
    const instructions: Array<{
      step: number;
      instruction: string;
      distance: number;
      type: string;
      coordinates?: [number, number]; // Add this property
    }> = [];
    let cumulativeDistance = 0;

    // Start instruction
    instructions.push({
      step: 1,
      instruction: `Head towards ${segments[0]?.name || 'the destination'}`,
      distance: 0,
      type: 'start',
    });

    // Road segments
    segments.forEach((seg, index) => {
      if (index > 0 && seg.name !== segments[index - 1].name) {
        cumulativeDistance += parseFloat(seg.distance);
        instructions.push({
          step: instructions.length + 1,
          instruction: `Continue on ${seg.name}`,
          distance: parseFloat(seg.distance),
          type: 'continue',
        });
      }
    });

    // Arrival at entry point
    const accessRoad = entryPoint.nearest_roads[0];
    if (accessRoad) {
      instructions.push({
        step: instructions.length + 1,
        instruction: `Turn onto ${accessRoad.name}`,
        distance: accessRoad.distance_meters,
        type: 'turn',
      });
    }

    // Final instruction
    const walkDistance = entryPoint.distance_to_parcel_meters;
    instructions.push({
      step: instructions.length + 1,
      instruction: `Walk ${walkDistance.toFixed(0)}m to Entry Point ${entryPoint.label}`,
      distance: walkDistance,
      type: 'walk',
      coordinates: entryPoint.coordinates,
    });

    instructions.push({
      step: instructions.length + 1,
      instruction: `You have arrived at ${parcel.lr_no}`,
      distance: 0,
      type: 'arrival',
      coordinates: entryPoint.coordinates,
    });

    return instructions;
  }

  /**
   * Generate physical address
   */
  private generatePhysicalAddress(
    parcel: any,
    adminBlock: any,
    accessRoad: any,
  ) {
    const parts: string[] = [];

    if (parcel.lr_no) {
      parts.push(`Parcel ${parcel.lr_no}`);
    }

    if (accessRoad?.name) {
      parts.push(`off ${accessRoad.name}`);
    }

    if (adminBlock?.name) {
      parts.push(adminBlock.name);
    }

    if (adminBlock?.constituen) {
      parts.push(adminBlock.constituen);
    }

    return parts.join(', ') || 'Address not available';
  }
}
