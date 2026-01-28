// src/routing/types/route.types.ts
export interface RouteSegment {
  name: string;
  road_type: string;
  geometry: string;
  distance: number;
  duration: number;
  instruction: string;
  maneuver_type?: string;
  maneuver_modifier?: string;
  sequence: number;
}

export interface RouteInstruction {
  step: number;
  instruction: string;
  distance: number;
  duration: number;
  type: string;
  modifier?: string;
  coordinates: { lat: number; lng: number };
  road_name: string;
}

export interface EntryPoint {
  gid: number;
  label: string;
  coordinates: { lat: number; lng: number };
  distance_to_parcel_meters: number;
  nearest_roads: NearestRoad[];
}

export interface NearestRoad {
  gid: number;
  name: string;
  fclass: string;
  ref: string | null;
  distance_meters: number;
}

export interface RouteResponse {
  destination: {
    parcel: any;
    entry_point: EntryPoint;
    access_road: NearestRoad | null;
    physical_address: string;
  };
  route: {
    segments: RouteSegment[];
    total_distance: number;
    total_duration: number;
    mode: string;
    has_traffic: boolean;
    traffic_level: 'low' | 'moderate' | 'heavy' | 'unknown';
    entry_point: {
      lat: number;
      lng: number;
      label: string;
    };
  };
  instructions: RouteInstruction[];
}
