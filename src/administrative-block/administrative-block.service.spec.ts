import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdministrativeBlockService } from './administrative-block.service';
import { AdministrativeBlock } from './entities/administrative-block.entity';

const mockBlockRepo = {
  query: jest.fn(),
};

const mockBlock = {
  gid: 77,
  const_code: 275,
  objectid: 1,
  objectid_2: 6,
  name: 'NGARA',
  constituen: 'STAREHE',
  county_nam: 'NAIROBI',
  short_name: 'NGARA',
  shape_area: 1378717.42,
};

describe('AdministrativeBlockService', () => {
  let service: AdministrativeBlockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdministrativeBlockService,
        { provide: getRepositoryToken(AdministrativeBlock), useValue: mockBlockRepo },
      ],
    }).compile();

    service = module.get<AdministrativeBlockService>(AdministrativeBlockService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated administrative blocks', async () => {
      mockBlockRepo.query
        .mockResolvedValueOnce([mockBlock])
        .mockResolvedValueOnce([{ count: '84' }]);

      const result = await service.findAll(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(84);
    });
  });

  describe('findOne', () => {
    it('should return a block by GID with geometry and centroid', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([{
        ...mockBlock,
        geometry: { type: 'MultiPolygon', coordinates: [] },
        centroid: { lat: -1.28, lng: 36.82 },
      }]);

      const result = await service.findOne(77);

      expect(result.gid).toBe(77);
      expect(result.name).toBe('NGARA');
      expect(result).toHaveProperty('centroid');
    });

    it('should throw NotFoundException for non-existent GID', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([]);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCounty', () => {
    it('should return blocks filtered by county', async () => {
      mockBlockRepo.query
        .mockResolvedValueOnce([mockBlock])
        .mockResolvedValueOnce([{ count: '17' }]);

      const result = await service.findByCounty('NAIROBI');

      expect(result.data).toHaveLength(1);
      expect(mockBlockRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['%NAIROBI%']),
      );
    });
  });

  describe('findByConstituency', () => {
    it('should return blocks in a constituency', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([mockBlock]);

      const result = await service.findByConstituency('STAREHE');

      expect(result).toHaveLength(1);
      expect(result[0].constituen).toBe('STAREHE');
    });
  });

  describe('search', () => {
    it('should search by name, constituency and county', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([mockBlock]);

      const result = await service.search('ngara');

      expect(result).toHaveLength(1);
      expect(mockBlockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%ngara%'],
      );
    });

    it('should return empty array when no matches', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([]);

      const result = await service.search('nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findAtPoint', () => {
    it('should return block at given coordinates', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([mockBlock]);

      const result = await service.findAtPoint(-1.2868, 36.8249);

      expect(result.name).toBe('NGARA');
      expect(mockBlockRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [-1.2868, 36.8249],
      );
    });

    it('should throw NotFoundException when no block at point', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([]);

      await expect(service.findAtPoint(-1.0, 36.0)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCounties', () => {
    it('should return counties with block counts', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([
        { county_nam: 'NAIROBI', block_count: '17' },
        { county_nam: 'KIAMBU', block_count: '12' },
      ]);

      const result = await service.getCounties();

      expect(result).toHaveLength(2);
      expect(result[0].county_nam).toBe('NAIROBI');
    });
  });

  describe('getConstituencies', () => {
    it('should return all constituencies', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([
        { constituen: 'STAREHE', county_nam: 'NAIROBI', block_count: '5' },
      ]);

      const result = await service.getConstituencies();

      expect(result).toHaveLength(1);
    });

    it('should filter constituencies by county', async () => {
      mockBlockRepo.query.mockResolvedValueOnce([
        { constituen: 'STAREHE', county_nam: 'NAIROBI', block_count: '5' },
      ]);

      await service.getConstituencies('NAIROBI');

      expect(mockBlockRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        ['%NAIROBI%'],
      );
    });
  });
});
