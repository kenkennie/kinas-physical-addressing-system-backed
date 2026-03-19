import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RoadsService } from './roads.service';
import { Road } from './entities/road.entity';

const mockRoadRepo = {
  query: jest.fn(),
};

const mockRoad = {
  gid: 55,
  osm_id: 4716862,
  name: 'Kenyatta Avenue',
  fclass: 'secondary',
  ref: 'UCB42',
  oneway: 'F',
  maxspeed: 50,
  layer: 0,
  bridge: 'F',
  tunnel: 'F',
  shape_leng: 0.003456,
};

describe('RoadsService', () => {
  let service: RoadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadsService,
        { provide: getRepositoryToken(Road), useValue: mockRoadRepo },
      ],
    }).compile();

    service = module.get<RoadsService>(RoadsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated roads', async () => {
      mockRoadRepo.query
        .mockResolvedValueOnce([mockRoad])
        .mockResolvedValueOnce([{ count: '48303' }]);

      const result = await service.findAll(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(48303);
      expect(result.pagination.totalPages).toBe(967);
    });

    it('should calculate correct offset for page 2', async () => {
      mockRoadRepo.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '100' }]);

      await service.findAll(2, 50);

      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 50],
      );
    });
  });

  describe('findOne', () => {
    it('should return a road by GID', async () => {
      mockRoadRepo.query.mockResolvedValueOnce([{ ...mockRoad, geometry: {} }]);

      const result = await service.findOne(55);

      expect(result.gid).toBe(55);
      expect(result.name).toBe('Kenyatta Avenue');
    });

    it('should throw NotFoundException for non-existent GID', async () => {
      mockRoadRepo.query.mockResolvedValue([]);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(9999)).rejects.toThrow('Road with GID 9999 not found');
    });
  });

  describe('search', () => {
    it('should search roads by name', async () => {
      mockRoadRepo.query.mockResolvedValueOnce([mockRoad]);

      const result = await service.search('Kenyatta');

      expect(result).toHaveLength(1);
      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.arrayContaining(['%Kenyatta%']),
      );
    });

    it('should filter by fclass when provided', async () => {
      mockRoadRepo.query.mockResolvedValueOnce([mockRoad]);

      await service.search('Kenyatta', 'secondary');

      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('fclass'),
        expect.arrayContaining(['secondary']),
      );
    });

    it('should return empty array when no matches', async () => {
      mockRoadRepo.query.mockResolvedValueOnce([]);

      const result = await service.search('nonexistent road');

      expect(result).toEqual([]);
    });
  });

  describe('findNearby', () => {
    it('should return roads near coordinates', async () => {
      const mockNearby = [{ ...mockRoad, distance_meters: 15.5 }];
      mockRoadRepo.query.mockResolvedValueOnce(mockNearby);

      const result = await service.findNearby(-1.2868, 36.8249, 200);

      expect(result).toHaveLength(1);
      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [-1.2868, 36.8249, 200],
      );
    });

    it('should use default radius of 200m', async () => {
      mockRoadRepo.query.mockResolvedValueOnce([]);

      await service.findNearby(-1.2868, 36.8249);

      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [-1.2868, 36.8249, 200],
      );
    });
  });

  describe('getFclasses', () => {
    it('should return road classifications with counts', async () => {
      const mockFclasses = [
        { fclass: 'residential', count: '18432' },
        { fclass: 'secondary', count: '3201' },
      ];
      mockRoadRepo.query.mockResolvedValueOnce(mockFclasses);

      const result = await service.getFclasses();

      expect(result).toHaveLength(2);
      expect(result[0].fclass).toBe('residential');
    });
  });

  describe('getByFclass', () => {
    it('should return roads filtered by fclass', async () => {
      mockRoadRepo.query
        .mockResolvedValueOnce([mockRoad])
        .mockResolvedValueOnce([{ count: '3201' }]);

      const result = await service.getByFclass('secondary');

      expect(result.data).toHaveLength(1);
      expect(mockRoadRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('fclass'),
        expect.arrayContaining(['secondary']),
      );
    });
  });
});
