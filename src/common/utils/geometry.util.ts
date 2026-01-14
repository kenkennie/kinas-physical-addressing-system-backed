export class GeometryUtil {
  static pointToPostGIS(lng: number, lat: number, srid: number = 4326): string {
    return `SRID=${srid};POINT(${lng} ${lat})`;
  }

  static bufferQuery(distance: number): string {
    return `ST_Buffer(geom::geography, ${distance})::geometry`;
  }

  static distanceQuery(lng: number, lat: number): string {
    return `ST_Distance(
      geom::geography,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    )`;
  }

  static intersectsQuery(lng: number, lat: number): string {
    return `ST_Intersects(
      geom,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    )`;
  }

  static withinQuery(lng: number, lat: number, distance: number): string {
    return `ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${distance}
    )`;
  }
}
