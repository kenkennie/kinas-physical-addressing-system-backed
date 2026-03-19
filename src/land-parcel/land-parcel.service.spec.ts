import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { LandParcelService } from './land-parcel.service';
import { LandParcel } from './entities/land-parcel.entity';
import { AddressService } from '../address/address.service';

const mockParcelRepo = {
  query: jest.fn(),
};

const mockAddressService = {
  getParcelDetails: jest.fn(),
};

const mockParcel = {
  gid: 1,
  lr_no: '1/136',
  fr_no: '85/22',
  area: 0.031715391,
  entity: 'Complex Shape',
  centroid: { lat: -1.2868, lng: 36.8249 },
};

const mockParcelContext = {
  parcel: mockParcel,
  administrative_block: { gid: 77, name: 'NGARA', short_name: 'NGARA' },
  entry_points: [{ gid: 209, label: '73', coordinates: { lat: -1.2866, lng: 36.8249 } }],
};

describe('LandParcelService', () => {
  let service: LandParcelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandParcelService,
        { provide: getRepositoryToken(LandParcel), useValue: mockParcelRepo },
        { provide: AddressService, useValue: mockAddressService },
      ],
    }).compile();

    service = module.get<LandParcelService>(LandParcelService);
    jest.clearAllMocks();
  });

  describe('getAllParcels', () => {
    it('should return paginated parcels', async () => {
      mockParcelRepo.query
        .mockResolvedValueOnce([mockParcel])
        .mockResolvedValueOnce([{ count: '1' }]);

      const result = await service.getAllParcels(1, 50);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should use default pagination values', async () => {
      mockParcelRepo.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: '0' }]);

      const result = await service.getAllParcels();

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(50);
    });
  });

  describe('getParcelContextByGid', () => {
    it('should return parcel context', async () => {
      mockParcelRepo.query.mockResolvedValueOnce([{ result: mockParcelContext }]);

      const result = await service.getParcelContextByGid(1);

      expect(result).toEqual(mockParcelContext);
      expect(mockParcelRepo.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it('should return undefined for non-existent parcel', async () => {
      mockParcelRepo.query.mockResolvedValueOnce([{}]);

      const result = await service.getParcelContextByGid(9999);

      expect(result).toBeUndefined();
    });
  });

  describe('findParcelGidAtPoint', () => {
    it('should return gid for valid coordinates', async () => {
      mockParcelRepo.query.mockResolvedValueOnce([{ gid: 1 }]);

      const result = await service.findParcelGidAtPoint(-1.2868, 36.8249);

      expect(result).toBe(1);
    });

    it('should throw NotFoundException when no parcel at point', async () => {
      mockParcelRepo.query.mockResolvedValueOnce([]);

      await expect(service.findParcelGidAtPoint(-1.0, 36.0)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for valid query', async () => {
      const mockSuggestions = [
        { gid: '1', lr_no: '1/136', short_name: 'NGARA', area: '0.03', constituency: 'STAREHE', administrative_name: 'NGARA' },
      ];
      mockParcelRepo.query.mockResolvedValueOnce(mockSuggestions);

      const result = await service.getSuggestions('1/1');

      expect(result).toHaveLength(1);
      expect(result[0].lr_no).toBe('1/136');
      expect(result[0].gid).toBe(1);
    });

    it('should return empty array for short query', async () => {
      const result = await service.getSuggestions('1');

      expect(result).toEqual([]);
      expect(mockParcelRepo.query).not.toHaveBeenCalled();
    });

    it('should return empty array for empty query', async () => {
      const result = await service.getSuggestions('');

      expect(result).toEqual([]);
    });
  });

  describe('searchAddress', () => {
    it('should search by lr_no', async () => {
      mockParcelRepo.query
        .mockResolvedValueOnce([{ gid: '1' }])
        .mockResolvedValueOnce([{ result: mockParcelContext }]);

      const result = await service.searchAddress({ lr_no: '1/136' });

      expect(result).toHaveLength(1);
    });

    it('should return empty array when no matches', async () => {
      mockParcelRepo.query.mockResolvedValueOnce([]);

      const result = await service.searchAddress({ lr_no: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });
});
