import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AddressService } from 'src/address/address.service';
import { EntryPoint } from 'src/entry-points/entities/entry-point.entity';
import { LandParcel } from 'src/land-parcel/entities/land-parcel.entity';
import { Road } from 'src/roads/entities/road.entity';
import { Repository } from 'typeorm';
import {
  CoordinateDto,
  RouteRequestDto,
  TransportMode,
} from './dto/routing.dto';

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(LandParcel)
    private parcelRepo: Repository<LandParcel>,
    @InjectRepository(EntryPoint)
    private entryPointRepo: Repository<EntryPoint>,
    @InjectRepository(Road)
    private roadRepo: Repository<Road>,
    private addressService: AddressService,
  ) {}

  async calculateRoute(routeDto: RouteRequestDto) {
    const parcelDetails = await this.addressService.getParcelDetails(
      routeDto.destination_lr_no,
    );

    const optimalEntryPoint = await this.selectOptimalEntryPoint(
      routeDto.origin,
      parcelDetails.entry_points,
      routeDto.mode,
      routeDto.preferred_entry_point,
    );

    const accessRoad = await this.findAccessRoad(optimalEntryPoint.gid);

    const route = await this.generatePreciseRoute(
      routeDto.origin,
      optimalEntryPoint,
      accessRoad,
      routeDto.mode,
    );

    return {
      destination: {
        parcel: parcelDetails.parcel,
        entry_point: optimalEntryPoint,
        access_road: accessRoad,
        physical_address: this.generatePhysicalAddress(
          parcelDetails.parcel,
          parcelDetails.administrative_block,
          optimalEntryPoint,
        ),
      },
      route,
      instructions: this.generateInstructions(
        route,
        optimalEntryPoint,
        accessRoad,
      ),
    };
  }

  private async selectOptimalEntryPoint(
    origin: CoordinateDto,
    entryPoints: EntryPoint[],
    mode: TransportMode,
    preferredLabel?: number,
  ): Promise<EntryPoint> {
    if (preferredLabel) {
      const preferred = entryPoints.find((ep) => ep.label === preferredLabel);
      if (preferred) return preferred;
    }

    const entryPointsWithScore = await Promise.all(
      entryPoints.map(async (ep) => {
        const distance = this.calculateDistance(origin, {
          lat: ep.y,
          lng: ep.x,
        });
        const roadAccess = await this.assessRoadAccess(ep.gid, mode);

        const score = distance * 0.6 + roadAccess.quality * -0.4;

        return { entryPoint: ep, score, distance, roadAccess };
      }),
    );

    entryPointsWithScore.sort((a, b) => a.score - b.score);
    return entryPointsWithScore[0].entryPoint;
  }

  private async assessRoadAccess(entryPointGid: number, mode: TransportMode) {
    const roads: Array<{ fclass: string; name: string; distance: number }> =
      await this.roadRepo.query(
        `
      SELECT r.fclass, r.name, ST_Distance(r.geom::geography, ep.geom::geography) as distance
      FROM roads r, entry_points ep
      WHERE ep.gid = $1
        AND ST_DWithin(r.geom::geography, ep.geom::geography, 100)
      ORDER BY distance ASC
      LIMIT 1
    `,
        [entryPointGid],
      );

    if (roads.length === 0) {
      return { quality: 0, accessible: false };
    }

    const road = roads[0];
    const accessibility = this.checkModeAccessibility(road.fclass, mode);
    const quality = this.calculateRoadQuality(road.fclass, road.distance);

    return { quality, accessible: accessibility, road };
  }

  private checkModeAccessibility(
    roadClass: string,
    mode: TransportMode,
  ): boolean {
    const accessMap = {
      motorway: ['driving'],
      trunk: ['driving'],
      primary: ['driving', 'motorcycle'],
      secondary: ['driving', 'motorcycle', 'cycling'],
      tertiary: ['driving', 'motorcycle', 'cycling', 'walking'],
      residential: ['driving', 'motorcycle', 'cycling', 'walking'],
      service: ['driving', 'motorcycle', 'cycling', 'walking'],
      footway: ['walking'],
      path: ['walking', 'cycling'],
    };

    return accessMap[roadClass]?.includes(mode) || false;
  }

  private calculateRoadQuality(roadClass: string, distance: number): number {
    const qualityMap = {
      motorway: 10,
      trunk: 9,
      primary: 8,
      secondary: 7,
      tertiary: 6,
      residential: 5,
      service: 4,
      footway: 3,
      path: 2,
    };

    const baseQuality = qualityMap[roadClass] || 1;
    const distancePenalty = Math.min(distance / 10, 5);

    return Math.max(baseQuality - distancePenalty, 0);
  }

  private async findAccessRoad(entryPointGid: number) {
    const result: any[] = await this.roadRepo.query(
      `
      SELECT r.*
      FROM roads r, entry_points ep
      WHERE ep.gid = $1
        AND ST_DWithin(r.geom::geography, ep.geom::geography, 50)
      ORDER BY ST_Distance(r.geom::geography, ep.geom::geography) ASC
      LIMIT 1
    `,
      [entryPointGid],
    );

    return (result[0] as Road) || null;
  }

  private async generatePreciseRoute(
    origin: CoordinateDto,
    entryPoint: EntryPoint,
    accessRoad: any,
    mode: TransportMode,
  ) {
    // Use pgRouting for precise routing
    const routeSegments = await this.parcelRepo.query(
      `
      SELECT 
        ST_AsGeoJSON(geom) as geometry,
        name,
        ref,
        fclass as road_type,
        ST_Length(geom::geography) as distance
      FROM roads
      WHERE ST_DWithin(
        geom::geography,
        ST_MakeLine(
          ST_SetSRID(ST_MakePoint($1, $2), 4326),
          ST_SetSRID(ST_MakePoint($3, $4), 4326)
        )::geography,
        1000
      )
      ORDER BY ST_Distance(
        geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      )
    `,
      [origin.lng, origin.lat, entryPoint.x, entryPoint.y],
    );
    const featureCollection = {
      type: 'FeatureCollection',
      features: routeSegments.map((seg) => ({
        type: 'Feature',
        geometry: JSON.parse(seg.geometry), // Convert string to Object
        properties: {
          name: seg.name,
          road_type: seg.road_type,
          distance: seg.distance,
        },
      })),
    };

    return {
      geometry: featureCollection,
      segments: routeSegments,
      total_distance: routeSegments.reduce(
        (sum, seg) => sum + parseFloat(seg.distance),
        0,
      ),
      mode,
      entry_point: {
        lat: entryPoint.y,
        lng: entryPoint.x,
        label: entryPoint.label,
      },
    };
  }

  private generateInstructions(
    route: { total_distance: number },
    entryPoint: EntryPoint,
    accessRoad: { name?: string } | null,
  ) {
    type Instruction = {
      step: number;
      instruction: string;
      distance?: number;
      type?: string;
      coordinates?: { lat: number; lng: number };
    };
    const instructions: Instruction[] = [];

    instructions.push({
      step: 1,
      instruction: `Head towards ${accessRoad?.name || 'the destination area'}`,
      distance: route.total_distance,
    });

    instructions.push({
      step: 2,
      instruction: `Arrive at Entry Point ${entryPoint.label} on ${accessRoad?.name || 'access road'}`,
      type: 'arrival',
      coordinates: { lat: entryPoint.y, lng: entryPoint.x },
    });

    return instructions;
  }

  private generatePhysicalAddress(
    parcel: LandParcel,
    adminBlock: any,
    entryPoint: EntryPoint,
  ) {
    const components = [
      `EP-${entryPoint.label}`,
      parcel.lr_no,
      adminBlock?.name || '',
      adminBlock?.constituen || '',
      adminBlock?.county_nam || 'NAIROBI',
    ].filter(Boolean);

    return components.join(', ');
  }

  private calculateDistance(
    point1: CoordinateDto,
    point2: CoordinateDto,
  ): number {
    const R = 6371000;
    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
