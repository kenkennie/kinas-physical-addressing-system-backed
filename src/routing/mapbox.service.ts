// src/routing/mapbox.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as Mapbox from '@mapbox/mapbox-sdk';
import * as MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import * as MapboxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

@Injectable()
export class MapboxService {
  private directionsClient: any;
  private geocodingClient: any;

  constructor() {
    const accessToken =
      // process.env.MAPBOX_ACCESS_TOKEN ||
      'pk.eyJ1Ijoia2VubmllMjUyNSIsImEiOiJjbWs2bzEwNXUwbmZjM2VzaHQ1OWs3cjdzIn0.hOjIiVZZdyTV1RyP8ZXG_w';
    const mapboxClient = (Mapbox as any)({
      accessToken,
    });
    this.directionsClient = (MapboxDirections as any)(mapboxClient);
    this.geocodingClient = (MapboxGeocoding as any)(mapboxClient);
  }

  /**
   * Get route with real-time traffic, road closures, and turn-by-turn
   */
  async getRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: string,
  ) {
    console.log('Mapbox getRoute called with:', {
      origin: {
        lat: typeof origin.lat,
        lng: typeof origin.lng,
        values: origin,
      },
      destination: {
        lat: typeof destination.lat,
        lng: typeof destination.lng,
        values: destination,
      },
      mode,
    });

    // Validate coordinates
    if (
      typeof origin.lat !== 'number' ||
      isNaN(origin.lat) ||
      typeof origin.lng !== 'number' ||
      isNaN(origin.lng) ||
      typeof destination.lat !== 'number' ||
      isNaN(destination.lat) ||
      typeof destination.lng !== 'number' ||
      isNaN(destination.lng)
    ) {
      throw new BadRequestException('Coordinates must contain valid numbers');
    }

    try {
      const response = await this.directionsClient
        .getDirections({
          profile: this.getMapboxProfile(mode),
          waypoints: [
            { coordinates: [origin.lng, origin.lat] },
            { coordinates: [destination.lng, destination.lat] },
          ],
          geometries: 'geojson',
          steps: true,
          alternatives: true, // Get alternative routes
          annotations: ['distance', 'duration', 'speed', 'congestion'], // Traffic data
          overview: 'full',
          continueStraight: false,
          bannerInstructions: true,
          voiceInstructions: true,
          language: 'en',
        })
        .send();

      if (!response.body.routes || response.body.routes.length === 0) {
        throw new BadRequestException('No route found');
      }

      return response.body;
    } catch (error) {
      console.error('Mapbox Directions Error:', error);
      throw new BadRequestException('Failed to calculate route');
    }
  }

  /**
   * Get multiple alternative routes
   */
  async getAlternativeRoutes(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    mode: string,
  ) {
    const profile = this.getMapboxProfile(mode);
    const response = await this.getRoute(origin, destination, profile);
    return response.routes; // Returns up to 3 alternative routes
  }

  /**
   * Reverse geocode to get road name at coordinates
   */
  async getRoadName(lat: number, lng: number): Promise<string> {
    try {
      const response = await this.geocodingClient
        .reverseGeocode({
          query: [lng, lat],
          types: ['address'],
          limit: 1,
        })
        .send();

      const feature = response.body.features[0];
      return feature?.text || feature?.place_name || 'Unnamed Road';
    } catch (error) {
      console.error('Geocoding error:', error);
      return 'Unnamed Road';
    }
  }

  /**
   * Map transport mode to Mapbox profile
   */
  private getMapboxProfile(
    mode: string,
  ): 'driving' | 'walking' | 'cycling' | 'driving-traffic' {
    switch (mode) {
      case 'driving':
      case 'motorcycle':
        return 'driving-traffic'; // Include real-time traffic
      case 'walking':
        return 'walking';
      case 'cycling':
        return 'cycling';
      default:
        return 'driving-traffic';
    }
  }
}
