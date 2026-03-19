import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Land Parcels', () => {
    it('GET /api/land-parcel should return paginated parcels', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/land-parcel')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('page');
    });

    it('GET /api/land-parcel/1 should return parcel context', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/land-parcel/1')
        .expect(200);

      expect(res.body).toHaveProperty('parcel');
      expect(res.body).toHaveProperty('entry_points');
      expect(res.body).toHaveProperty('administrative_block');
    });

    it('GET /api/land-parcel/suggestions should return suggestions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/land-parcel/suggestions?q=1/1')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/land-parcel/search should return search results', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/land-parcel/search')
        .send({ lr_no: '1/136' })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Roads', () => {
    it('GET /api/roads should return paginated roads', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roads')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination.total).toBeGreaterThan(0);
    });

    it('GET /api/roads/fclasses should return road classifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roads/fclasses')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('fclass');
      expect(res.body[0]).toHaveProperty('count');
    });

    it('GET /api/roads/search should return matching roads', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roads/search?name=Uhuru')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/roads/nearby should return nearby roads', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/roads/nearby?lat=-1.2868&lng=36.8249')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Administrative Blocks', () => {
    it('GET /api/administrative-block should return paginated blocks', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/administrative-block')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('GET /api/administrative-block/counties should return counties', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/administrative-block/counties')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('county_nam');
    });

    it('GET /api/administrative-block/at-point should return block at coordinates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/administrative-block/at-point?lat=-1.2868&lng=36.8249')
        .expect(200);

      expect(res.body).toHaveProperty('name');
      expect(res.body).toHaveProperty('county_nam');
    });
  });

  describe('Entry Points', () => {
    it('GET /api/entry-points should return paginated entry points', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/entry-points')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
    });

    it('GET /api/entry-points/nearby should return nearby entry points', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/entry-points/nearby?lat=-1.2868&lng=36.8249')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Address', () => {
    it('GET /api/address/parcel/:lr_no should return parcel details', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/address/parcel/1%2F136')
        .expect(200);

      expect(res.body).toHaveProperty('parcel');
      expect(res.body.parcel.lr_no).toBe('1/136');
    });

    it('POST /api/address/search should return search results', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/address/search')
        .send({ lr_no: '1/136' })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
