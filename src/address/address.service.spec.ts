import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AddressService } from './address.service';
import { LandParcel } from '../land-parcel/entities/land-parcel.entity';
import { EntryPoint } from '../entry-points/entities/entry-point.entity';
import { AdministrativeBlock } from '../administrative-block/entities/administrative-block.entity';

const mockParcelRepo = {
  createQueryBuilder: jest.fn(),
  findOne: jest.fn(),
  query: jest.fn(),
};

const mockEntryPointRepo = {
  query: jest.fn(),
};

const mockAdminBlockRepo = {
  query: jest.fn(),
};

const mockParcel = {
  gid: 1,
  lr_no: '1/136',
  fr_no: '85/22',
  area: 0.031715391,
  entity: 'Complex Shape',
  pas: '1/600',
  geom: {},
};

describe('AddressService', () => {
  let service: AddressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressService,
        { provide: getRepositoryToken(LandParcel), useValue: mockParcelRepo },
        { provide: getRepositoryToken(EntryPoint), useValue: mockEntryPointRepo },
        { provide: getRepositoryToken(AdministrativeBlock), useValue: mockAdminBlockRepo },
      ],
    }).compile();

    service = module.get<AddressService>(AddressService);
    jest.clearAllMocks();
  });

  describe('getParcelDetails', () => {
    it('should return full parcel details by lr_no', async () => {
      mockParcelRepo.findOne.mockResolvedValueOnce(mockParcel);
      mockEntryPointRepo.query.mockResolvedValueOnce([
        { gid: 209, label: 73, lat: -1.2866, lng: 36.8249 },
      ]);
      mockParcelRepo.query
        .mockResolvedValueOnce([{ gid: 55, name: 'Moi Avenue', distance: 9.63 }])
        .mockResolvedValueOnce([{ gid: 77, name: 'NGARA' }])
        .mockResolvedValueOnce([{ lat: -1.2868, lng: 36.8249 }]);

      const result = await service.getParcelDetails('1/136');

      expect(result.parcel.lr_no).toBe('1/136');
      expect(result).toHaveProperty('entry_points');
      expect(result).toHaveProperty('nearby_roads');
      expect(result).toHaveProperty('administrative_block');
      expect(result).toHaveProperty('centroid');
    });

    it('should throw error when parcel not found', async () => {
      mockParcelRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.getParcelDetails('999/999')).rejects.toThrow('Parcel not found');
    });
  });

  describe('searchAddress', () => {
    it('should search by lr_no', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([mockParcel]),
      };
      mockParcelRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockEntryPointRepo.query.mockResolvedValue([]);
      mockParcelRepo.query.mockResolvedValue([]);

      const result = await service.searchAddress({ lr_no: '1/136' });

      expect(result).toHaveLength(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('lr_no'),
        expect.any(Object),
      );
    });

    it('should search by fr_no', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([mockParcel]),
      };
      mockParcelRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockEntryPointRepo.query.mockResolvedValue([]);
      mockParcelRepo.query.mockResolvedValue([]);

      await service.searchAddress({ fr_no: '85/22' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('fr_no'),
        expect.any(Object),
      );
    });

    it('should search by proximity when lat/lng provided', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([]),
      };
      mockParcelRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchAddress({ lat: -1.2868, lng: 36.8249, radius: 500 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ST_DWithin'),
        expect.objectContaining({ lat: -1.2868, lng: 36.8249, radius: 500 }),
      );
    });

    it('should return empty array when no results', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([]),
      };
      mockParcelRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchAddress({ lr_no: 'nonexistent' });

      expect(result).toEqual([]);
    });
  });
});
