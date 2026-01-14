export class DistanceCalculator {
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly EARTH_RADIUS_M = 6371000;

  static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    unit: 'km' | 'm' = 'm',
  ): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const radius = unit === 'km' ? this.EARTH_RADIUS_KM : this.EARTH_RADIUS_M;

    return radius * c;
  }

  static bearingBetweenPoints(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const toDeg = (radians: number) => (radians * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x =
      Math.cos(lat1Rad) * Math.sin(lat2Rad) -
      Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }
}
