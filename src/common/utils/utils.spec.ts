import { AddressGenerator } from './address-generator.util';
import { GeometryUtil } from './geometry.util';

describe('AddressGenerator', () => {
  const mockParcel = {
    gid: 1,
    lr_no: '1/136',
    fr_no: '85/22',
    area: 0.031715391,
    entity: 'Complex Shape',
    objectid: 1,
    pas: '1/600',
    geom: {},
  } as any;

  const mockAdminBlock = {
    gid: 77,
    name: 'NGARA',
    constituen: 'STAREHE',
    county_nam: 'NAIROBI',
    short_name: 'NGARA',
    const_code: 275,
    objectid: 1,
    objectid_2: 6,
    shape_area: 1378717.42,
    geom: {},
  } as any;

  const mockEntryPoint = {
    gid: 209,
    label: 73,
    x: 257125.0,
    y: 9858037.0,
    geom: {},
  } as any;

  describe('generatePhysicalAddress', () => {
    it('should generate address with all components', () => {
      const address = AddressGenerator.generatePhysicalAddress(
        mockParcel,
        mockAdminBlock,
        mockEntryPoint,
      );

      expect(address).toContain('EP-73');
      expect(address).toContain('1/136');
      expect(address).toContain('NGARA');
      expect(address).toContain('STAREHE');
      expect(address).toContain('NAIROBI');
    });

    it('should generate address without entry point', () => {
      const address = AddressGenerator.generatePhysicalAddress(
        mockParcel,
        mockAdminBlock,
      );

      expect(address).not.toContain('EP-');
      expect(address).toContain('1/136');
      expect(address).toContain('NGARA');
    });

    it('should generate address without admin block', () => {
      const address = AddressGenerator.generatePhysicalAddress(
        mockParcel,
        null,
        mockEntryPoint,
      );

      expect(address).toContain('EP-73');
      expect(address).toContain('1/136');
      expect(address).not.toContain('NGARA');
    });

    it('should generate address with only parcel', () => {
      const address = AddressGenerator.generatePhysicalAddress(mockParcel, null);

      expect(address).toBe('1/136');
    });
  });

  describe('generateShortCode', () => {
    it('should generate a short code starting with KE-', () => {
      const code = AddressGenerator.generateShortCode(mockParcel);

      expect(code).toMatch(/^KE-[A-Z0-9]+$/);
    });

    it('should generate consistent codes for the same parcel', () => {
      const code1 = AddressGenerator.generateShortCode(mockParcel);
      const code2 = AddressGenerator.generateShortCode(mockParcel);

      expect(code1).toBe(code2);
    });

    it('should generate different codes for different parcels', () => {
      const parcel2 = { ...mockParcel, lr_no: '1/200' } as any;

      const code1 = AddressGenerator.generateShortCode(mockParcel);
      const code2 = AddressGenerator.generateShortCode(parcel2);

      expect(code1).not.toBe(code2);
    });
  });
});

describe('GeometryUtil', () => {
  describe('pointToPostGIS', () => {
    it('should generate a valid PostGIS point string', () => {
      const result = GeometryUtil.pointToPostGIS(36.8249, -1.2868);

      expect(result).toBe('SRID=4326;POINT(36.8249 -1.2868)');
    });

    it('should use custom SRID when provided', () => {
      const result = GeometryUtil.pointToPostGIS(36.8249, -1.2868, 3857);

      expect(result).toBe('SRID=3857;POINT(36.8249 -1.2868)');
    });
  });

  describe('bufferQuery', () => {
    it('should generate a buffer query string', () => {
      const result = GeometryUtil.bufferQuery(50);

      expect(result).toContain('ST_Buffer');
      expect(result).toContain('50');
    });
  });

  describe('distanceQuery', () => {
    it('should generate a distance query with coordinates', () => {
      const result = GeometryUtil.distanceQuery(36.8249, -1.2868);

      expect(result).toContain('ST_Distance');
      expect(result).toContain('36.8249');
      expect(result).toContain('-1.2868');
    });
  });

  describe('intersectsQuery', () => {
    it('should generate an intersects query', () => {
      const result = GeometryUtil.intersectsQuery(36.8249, -1.2868);

      expect(result).toContain('ST_Intersects');
      expect(result).toContain('36.8249');
      expect(result).toContain('-1.2868');
    });
  });

  describe('withinQuery', () => {
    it('should generate a within query with distance', () => {
      const result = GeometryUtil.withinQuery(36.8249, -1.2868, 200);

      expect(result).toContain('ST_DWithin');
      expect(result).toContain('36.8249');
      expect(result).toContain('-1.2868');
      expect(result).toContain('200');
    });
  });
});
