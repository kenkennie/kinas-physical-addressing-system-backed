import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EntryPointsService } from './entry-points.service';
import { EntryPoint } from './entities/entry-point.entity';

const mockEntryPointRepo = {
  query: jest.fn(),
};

const mockEntryPoint = {
  gid: 1,
  label: 73,
  x: 257125.0,
  y: 9858037.0,
  lat: -1.2866,
  lng: 36.8249,
};

describe('EntryPointsService', () => {
  let service: EntryPointsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntryPointsService,
        { provide: getRepositoryToken(EntryPoint), useValue: mockEntryPointRepo },
      ],
    }).compile();

    service = module.get<EntryPointsService>(EntryPointsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated entry points', async () => {
      mockEntryPointRepo.query
        .mockResolvedValueOnce([mockEntryPoint])
        .mockResolvedValueOnce([{ count: '274' }]);

      const result = await service.findAll(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(274);
    });
  });

  describe('findOne', () => {
    it('should return entry point by GID', async () => {
      mockEntryPointRepo.query.mockResolvedValueOnce([{
        ...mockEntryPoint,
        geometry: { type: 'Point', coordinates: [36.8249, -1.2866] },
      }]);

      const result = await service.findOne(1);

      expect(result.gid).toBe(1);
      expect(result.lat).toBe(-1.2866);
      expect(result.lng).toBe(36.8249);
    });

    it('should throw NotFoundException for non-existent GID', async () => {
      mockEntryPointRepo.query.mockResolvedValue([]);

      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(9999)).rejects.toThrow('Entry point with GID 9999 not found');
    });
  });

  describe('findNearby', () => {
    it('should return entry points near coordinates', async () => {
      const mockNearby = [{ ...mockEntryPoint, distance_meters: 25.5 }];
      mockEntryPointRepo.query.mockResolvedValueOnce(mockNearby);

      const result = await service.findNearby(-1.2868, 36.8249, 100);

      expect(result).toHaveLength(1);
      expect(mockEntryPointRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [-1.2868, 36.8249, 100],
      );
    });

    it('should use default radius of 100m', async () => {
      mockEntryPointRepo.query.mockResolvedValueOnce([]);

      await service.findNearby(-1.2868, 36.8249);

      expect(mockEntryPointRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [-1.2868, 36.8249, 100],
      );
    });
  });

  describe('findByParcel', () => {
    it('should return entry points for a parcel', async () => {
      const mockPoints = [{ ...mockEntryPoint, distance_to_parcel_meters: 3.28 }];
      mockEntryPointRepo.query.mockResolvedValueOnce(mockPoints);

      const result = await service.findByParcel('1/136');

      expect(result).toHaveLength(1);
      expect(mockEntryPointRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        ['1/136'],
      );
    });

    it('should return empty array when no entry points near parcel', async () => {
      mockEntryPointRepo.query.mockResolvedValueOnce([]);

      const result = await service.findByParcel('1/999');

      expect(result).toEqual([]);
    });
  });

  describe('findNearestRoads', () => {
    it('should return nearest roads to an entry point', async () => {
      mockEntryPointRepo.query
        .mockResolvedValueOnce([{ ...mockEntryPoint, geometry: {} }])
        .mockResolvedValueOnce([
          { gid: 55, name: 'Moi Avenue', fclass: 'secondary', ref: 'UCB42', distance_meters: 9.63 },
        ]);

      const result = await service.findNearestRoads(1, 100);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Moi Avenue');
    });

    it('should throw NotFoundException when entry point does not exist', async () => {
      mockEntryPointRepo.query.mockResolvedValueOnce([]);

      await expect(service.findNearestRoads(9999)).rejects.toThrow(NotFoundException);
    });
  });
});
