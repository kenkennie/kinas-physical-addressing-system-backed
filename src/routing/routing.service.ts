// src/routing/routing.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { EntryPoint } from '../entry-points/entities/entry-point.entity';
import { AdministrativeBlock } from '../administrative-block/entities/administrative-block.entity';
import { MapboxService } from './mapbox.service';
import {
  CalculateRouteDto,
  AlternativeRoutesDto,
  TransportMode,
} from './dto/routing.dto';
import {
  RouteSegment,
  RouteInstruction,
  RouteResponse,
} from './types/route.types';

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(LandParcel)
    private readonly parcelRepo: Repository<LandParcel>,
    @InjectRepository(EntryPoint)
    private readonly entryPointRepo: Repository<EntryPoint>,
    @InjectRepository(AdministrativeBlock)
    private readonly adminBlockRepo: Repository<AdministrativeBlock>,
    private readonly mapboxService: MapboxService,
  ) {}

  /**
   * Calculate route with real-time traffic and road conditions
   */
  async calculateRoute(dto: CalculateRouteDto): Promise<RouteResponse> {
    const { origin, destination_lr_no, mode, preferred_entry_point } = dto;

    // 1. Get parcel with entry points
    const parcelData = await this.getParcelWithEntryPoints(destination_lr_no);

    if (!parcelData || parcelData.entry_points.length === 0) {
      throw new NotFoundException('Parcel or entry points not found');
    }

    // 2. Select entry point
    let selectedEntry = parcelData.entry_points[0];
    if (preferred_entry_point) {
      selectedEntry =
        parcelData.entry_points.find(
          (ep) => ep.gid === preferred_entry_point,
        ) || selectedEntry;
    }

    // 3. Get Mapbox route to entry point
    const mapboxRoute = await this.mapboxService.getRoute(
      origin,
      selectedEntry.coordinates,
      mode,
    );

    const primaryRoute = mapboxRoute.routes[0];

    // 4. Build route response with Mapbox data
    const segments = await this.buildRouteSegments(primaryRoute, selectedEntry);
    const instructions = this.buildInstructions(
      primaryRoute,
      selectedEntry,
      parcelData.parcel,
    );

    // 5. Get access road info
    const accessRoad = selectedEntry.nearest_roads[0] || null;

    // 6. Extract traffic and annotation data safely
    const leg = primaryRoute.legs[0];
    const annotation = leg?.annotation as any;
    const congestionData = Array.isArray(annotation)
      ? annotation.find((a: any) => a.congestion)?.congestion
      : annotation?.congestion;

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
        segments,
        total_distance: primaryRoute.distance,
        total_duration: primaryRoute.duration,
        mode: mode,
        has_traffic: true,
        traffic_level: this.getTrafficLevel(congestionData),
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
   * Get alternative routes for different entry points
   */
  async getAlternativeRoutes(
    dto: AlternativeRoutesDto,
  ): Promise<RouteResponse[]> {
    const { origin, destination_lr_no, mode } = dto;

    const parcelData = await this.getParcelWithEntryPoints(destination_lr_no);

    if (!parcelData || parcelData.entry_points.length === 0) {
      throw new NotFoundException('Parcel or entry points not found');
    }

    // Calculate route for each entry point
    const routes = await Promise.all(
      parcelData.entry_points.map(async (entry) => {
        try {
          const mapboxRoute = await this.mapboxService.getRoute(
            origin,
            entry.coordinates,
            mode,
          );

          const primaryRoute = mapboxRoute.routes[0];
          const segments = await this.buildRouteSegments(primaryRoute, entry);
          const instructions = this.buildInstructions(
            primaryRoute,
            entry,
            parcelData.parcel,
          );
          const accessRoad = entry.nearest_roads[0] || null;

          const leg = primaryRoute.legs[0];
          const annotation = leg?.annotation as any;
          const congestionData = Array.isArray(annotation)
            ? annotation.find((a: any) => a.congestion)?.congestion
            : annotation?.congestion;

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
              segments,
              total_distance: primaryRoute.distance,
              total_duration: primaryRoute.duration,
              mode: mode,
              has_traffic: true,
              traffic_level: this.getTrafficLevel(congestionData),
              entry_point: {
                lat: entry.coordinates.lat,
                lng: entry.coordinates.lng,
                label: entry.label,
              },
            },
            instructions,
          };
        } catch (error) {
          console.error(
            `Failed to calculate route for entry ${entry.gid}:`,
            error,
          );
          return null;
        }
      }),
    );

    // Filter out failed routes and sort by distance
    return routes
      .filter((route): route is RouteResponse => route !== null)
      .sort((a, b) => a.route.total_distance - b.route.total_distance);
  }

  /**
   * Build route segments from Mapbox response
   */
  private async buildRouteSegments(
    mapboxRoute: any,
    entryPoint: any,
  ): Promise<RouteSegment[]> {
    const segments: RouteSegment[] = [];

    const steps = mapboxRoute.legs[0].steps;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      segments.push({
        name: step.name || 'Unnamed Road',
        road_type: step.mode || 'road',
        geometry: JSON.stringify(step.geometry),
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        instruction: step.maneuver?.instruction || `Continue on ${step.name}`,
        maneuver_type: step.maneuver?.type,
        maneuver_modifier: step.maneuver?.modifier,
        sequence: i + 1,
      });
    }

    const accessRoad = entryPoint.nearest_roads[0];
    if (accessRoad && entryPoint.distance_to_parcel_meters > 0) {
      segments.push({
        name: `Walk to Entry Point ${entryPoint.label}`,
        road_type: 'walk',
        geometry: JSON.stringify({
          type: 'LineString',
          coordinates: [
            [entryPoint.coordinates.lng, entryPoint.coordinates.lat],
            [entryPoint.coordinates.lng, entryPoint.coordinates.lat],
          ],
        }),
        distance: Math.round(entryPoint.distance_to_parcel_meters),
        duration: Math.round(entryPoint.distance_to_parcel_meters / 1.4),
        instruction: `Walk ${Math.round(entryPoint.distance_to_parcel_meters)}m to Entry Point ${entryPoint.label}`,
        maneuver_type: 'arrive',
        sequence: segments.length + 1,
      });
    }

    return segments;
  }

  /**
   * Build turn-by-turn instructions
   */
  private buildInstructions(
    mapboxRoute: any,
    entryPoint: any,
    parcel: any,
  ): RouteInstruction[] {
    const instructions: RouteInstruction[] = [];
    const steps = mapboxRoute.legs[0].steps;

    steps.forEach((step: any, index: number) => {
      instructions.push({
        step: index + 1,
        instruction: step.maneuver?.instruction || `Continue on ${step.name}`,
        distance: Math.round(step.distance),
        duration: Math.round(step.duration),
        type: step.maneuver?.type || 'continue',
        modifier: step.maneuver?.modifier,
        coordinates: {
          lat: step.maneuver?.location?.[1] || 0,
          lng: step.maneuver?.location?.[0] || 0,
        },
        road_name: step.name || 'Unnamed Road',
      });
    });

    instructions.push({
      step: instructions.length + 1,
      instruction: `You have arrived at ${parcel.lr_no} - Entry Point ${entryPoint.label}`,
      distance: 0,
      duration: 0,
      type: 'arrive',
      coordinates: entryPoint.coordinates,
      road_name: '',
    });

    return instructions;
  }

  private getTrafficLevel(
    congestion: any,
  ): 'low' | 'moderate' | 'heavy' | 'unknown' {
    if (!congestion || !Array.isArray(congestion) || congestion.length === 0) {
      return 'unknown';
    }

    const congestionCounts = {
      low: 0,
      moderate: 0,
      heavy: 0,
      severe: 0,
    };

    congestion.forEach((level: string) => {
      if (level in congestionCounts) {
        congestionCounts[level as keyof typeof congestionCounts]++;
      }
    });

    if (
      congestionCounts.severe > 0 ||
      congestionCounts.heavy > congestion.length / 2
    ) {
      return 'heavy';
    } else if (congestionCounts.moderate > congestion.length / 3) {
      return 'moderate';
    }
    return 'low';
  }

  private async getParcelWithEntryPoints(lr_no: string) {
    // Get parcel
    const parcel = await this.parcelRepo.findOne({ where: { lr_no } });
    if (!parcel) {
      return null;
    }

    // Get entry points within 1000 meters of the parcel
    const entryPointsRaw = await this.entryPointRepo.query(
      `
      SELECT
        ep.gid,
        ep.label,
        ST_X(ST_Transform(ep.geom, 4326)) as lng,
        ST_Y(ST_Transform(ep.geom, 4326)) as lat,
        ROUND(ST_Distance(ep.geom::geography, p.geom::geography)::numeric, 2) AS distance_to_parcel_meters
      FROM entry_points ep, land_parcel p
      WHERE p.lr_no = $1 AND ST_Distance(ep.geom::geography, p.geom::geography) < 1000
      ORDER BY distance_to_parcel_meters
    `,
      [lr_no],
    );

    // Transform to expected format
    const entry_points = entryPointsRaw.map((ep) => ({
      gid: ep.gid,
      label: ep.label,
      coordinates: { lat: parseFloat(ep.lat), lng: parseFloat(ep.lng) },
      distance_to_parcel_meters: parseFloat(ep.distance_to_parcel_meters),
      nearest_roads: [], // TODO: implement nearest roads
    }));

    // Get administrative block containing the parcel
    const adminBlock = await this.adminBlockRepo.query(
      `
      SELECT * FROM administrative_block
      WHERE ST_Contains(geom, (SELECT geom FROM land_parcel WHERE lr_no = $1))
      LIMIT 1
    `,
      [lr_no],
    );

    const administrative_block = adminBlock[0] || null;

    return {
      parcel,
      entry_points,
      administrative_block,
    };
  }

  private generatePhysicalAddress(
    parcel: any,
    adminBlock: any,
    accessRoad: any,
  ): string {
    const parts: string[] = [];

    if (parcel.lr_no) parts.push(`Parcel ${parcel.lr_no}`);
    if (accessRoad?.name) parts.push(`off ${accessRoad.name}`);
    if (adminBlock?.name) parts.push(adminBlock.name);
    if (adminBlock?.constituen) parts.push(adminBlock.constituen);

    return parts.join(', ') || 'Address not available';
  }
}
