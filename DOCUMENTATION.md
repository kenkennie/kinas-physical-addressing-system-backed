# Anwani Physical Addressing API — Full Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Setup](#4-environment-setup)
5. [Running the Application](#5-running-the-application)
6. [Database Setup](#6-database-setup)
7. [Data Import](#7-data-import)
8. [API Reference](#8-api-reference)
9. [Swagger UI](#9-swagger-ui)
10. [Testing](#10-testing)
11. [Docker Reference](#11-docker-reference)

---

## 1. Project Overview

Anwani Physical Addressing API is a geospatial REST API built for Kenya's physical addressing system. It manages land parcels, roads, administrative blocks, and entry points — and provides address generation and Mapbox-powered routing to any parcel in the system.

**Key capabilities:**
- Spatial queries against PostGIS (point-in-polygon, proximity, intersection)
- Vector tile generation for map rendering (Mapbox GL JS compatible)
- Address lookup and autocomplete by LR number
- Turn-by-turn routing to land parcels via entry points
- Administrative hierarchy: County → Constituency → Block

---

## 2. Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| NestJS | 11 | Node.js framework |
| TypeScript | 5.7 | Language |
| PostgreSQL | 16 | Database |
| PostGIS | 3.4 | Spatial extensions |
| TypeORM | 0.3 | ORM |
| Mapbox SDK | 0.16 | Routing & geocoding |
| Docker + Compose | — | Containerisation |
| Swagger / OpenAPI | 8 | API documentation |

---

## 3. Project Structure

```
src/
├── address/                        # Address search and parcel lookup
│   ├── dto/address.dto.ts
│   ├── address.controller.ts
│   ├── address.service.ts
│   └── address.module.ts
│
├── administrative-block/           # Counties, constituencies, blocks
│   ├── entities/administrative-block.entity.ts
│   ├── administrative-block.controller.ts
│   ├── administrative-block.service.ts
│   └── administrative-block.module.ts
│
├── common/utils/                   # Shared utilities
│   ├── address-generator.util.ts
│   └── geometry.util.ts
│
├── config/
│   ├── database.config.ts          # TypeORM connection factory
│   └── postgresql.conf
│
├── entry-points/                   # Entry points linked to parcels
│   ├── entities/entry-point.entity.ts
│   ├── entry-points.controller.ts
│   ├── entry-points.service.ts
│   └── entry-points.module.ts
│
├── land-parcel/                    # Core land parcel module
│   ├── dto/searchDto.ts
│   ├── entities/land-parcel.entity.ts
│   ├── land-parcel.controller.ts
│   ├── land-parcel.service.ts
│   └── land-parcel.module.ts
│
├── roads/                          # OSM road network
│   ├── entities/road.entity.ts
│   ├── roads.controller.ts
│   ├── roads.service.ts
│   └── roads.module.ts
│
├── routing/                        # Mapbox routing
│   ├── dto/routing.dto.ts
│   ├── types/route.types.ts
│   ├── mapbox.service.ts
│   ├── routing.controller.ts
│   ├── routing.service.ts
│   └── routing.module.ts
│
├── app.module.ts                   # Root module
└── main.ts                         # Bootstrap + Swagger setup
```

---

## 4. Environment Setup

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API port | `3000` |
| `DB_HOST` | Postgres host | `localhost` or `postgres` (Docker) |
| `DB_PORT` | Postgres port | `5432` |
| `DB_USER` | Postgres user | `username` |
| `DB_PASSWORD` | Postgres password | `your_password` |
| `DB_NAME` | Database name | `anwani_db` |
| `DB_PORT_HOST` | Host-side port (Docker only) | `5432` |
| `MAPBOX_ACCESS_TOKEN` | Mapbox token (starts with `pk.`) | `pk.eyJ1Ijoixx...` |

> **Note:** When running via Docker Compose set `DB_HOST=postgres`. When running locally set `DB_HOST=localhost`.

> **Mapbox token:** Get one free at https://account.mapbox.com/access-tokens/

---

## 5. Running the Application

### Option A — Docker (recommended)

Runs the API and a PostGIS database together. No local PostgreSQL needed.

```bash
# Development (hot reload)
npm run docker:dev

# Tear down
npm run docker:dev:down

# Production
npm run docker:prod
npm run docker:prod:down
```

### Option B — Postgres in Docker, API locally

Best for development — database is containerised but the API runs directly with hot reload.

```bash
# Start only the database
docker compose up postgres -d

# Start the API locally
npm install
npm run start:dev
```

### Option C — Fully local

Requires PostgreSQL 16 + PostGIS installed locally.

```bash
npm install
npm run start:dev
```

### Available npm scripts

```bash
npm run start:dev       # Hot reload development
npm run start:debug     # Debug mode
npm run build           # Compile TypeScript
npm run start:prod      # Run compiled build
npm run lint            # ESLint with auto-fix
npm run format          # Prettier format
npm run test            # Unit tests
npm run test:cov        # Unit tests with coverage
npm run test:e2e        # End-to-end tests
npm run docker:dev      # Docker development stack
npm run docker:prod     # Docker production stack
```

---

## 6. Database Setup

### Enable PostGIS

Connect as a superuser and run:

```bash
psql -U $(whoami) -d anwani_db
```

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Grant permissions

```sql
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO <your_db_user>;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO <your_db_user>;
```

### Create tables

Set `synchronize: true` temporarily in `src/config/database.config.ts`, start the app once to let TypeORM create all tables, then set it back to `false`.

---

## 7. Data Import

All spatial data must be in **SRID 4326 (WGS84)** after import. The raw shapefiles use local projections and must be corrected.

### Prerequisites

```bash
# Verify shp2pgsql is available (installed with PostGIS via Homebrew)
which shp2pgsql
```

---

### 7.1 Roads — OpenStreetMap Kenya

**Source:** https://download.geofabrik.de/africa/kenya.html
Download `kenya-latest-free.shp.zip`, extract, use `gis_osm_roads_free_1.shp`.

```bash
shp2pgsql -I -s 4326 gis_osm_roads_free_1.shp roads | psql -U <user> -d anwani_db
```

**Verify:**
```sql
SELECT COUNT(*) FROM roads;
-- Expected: ~48,303 rows

SELECT gid, name, fclass FROM roads LIMIT 5;
```

---

### 7.2 Administrative Blocks — Kenya Constituencies

**Source:** https://hub.arcgis.com/datasets/iebc::kenya-constituencies/explore
Download as Shapefile.

```bash
shp2pgsql -I -s 21037 Kenya_Constituencies.shp administrative_block | psql -U <user> -d anwani_db
```

**Fix SRID and convert to 4326:**
```sql
SELECT UpdateGeometrySRID('administrative_block', 'geom', 21037);

ALTER TABLE administrative_block
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_Transform(geom, 4326);
```

**Add missing `short_name` column:**
```sql
ALTER TABLE administrative_block ADD COLUMN short_name VARCHAR(20);
UPDATE administrative_block SET short_name = UPPER(SUBSTRING(name FROM 1 FOR 20));
```

**Verify:**
```sql
SELECT COUNT(*) FROM administrative_block;
-- Expected: 84 rows

SELECT gid, name, short_name, constituen, county_nam FROM administrative_block LIMIT 5;
```

---

### 7.3 Land Parcels — Survey of Kenya / NLIMS

**Source:** Survey of Kenya or NLIMS (National Land Information Management System)

```bash
shp2pgsql -I -s 21037 land_parcels.shp land_parcel | psql -U <user> -d anwani_db
```

**Fix SRID and convert to 4326:**
```sql
SELECT UpdateGeometrySRID('land_parcel', 'geom', 21037);

ALTER TABLE land_parcel
  ALTER COLUMN geom TYPE geometry(MultiPolygon, 4326)
  USING ST_Transform(geom, 4326);
```

**Verify location (should be in Nairobi ~36.8°E, -1.28°N):**
```sql
SELECT ST_AsText(ST_Extent(geom)) FROM land_parcel;
```

**Verify:**
```sql
SELECT COUNT(*) FROM land_parcel;
SELECT gid, lr_no, fr_no, entity FROM land_parcel LIMIT 5;
```

---

### 7.4 Entry Points — Survey of Kenya / NLIMS

```bash
shp2pgsql -I -s 21037 entry_points.shp entry_points | psql -U <user> -d anwani_db
```

**Fix SRID and convert to 4326:**
```sql
SELECT UpdateGeometrySRID('entry_points', 'geom', 21037);

ALTER TABLE entry_points
  ALTER COLUMN geom TYPE geometry(Point, 4326)
  USING ST_Transform(geom, 4326);
```

**Verify:**
```sql
SELECT COUNT(*) FROM entry_points;
SELECT gid, label, ST_Y(geom) as lat, ST_X(geom) as lng FROM entry_points LIMIT 5;
```

---

### 7.5 Spatial relationship validation

Run these three tests to confirm all datasets are correctly aligned:

```sql
-- Test 1: Land parcels intersect administrative blocks
SELECT lp.gid, lp.lr_no, ab.name, ab.short_name
FROM land_parcel lp
JOIN administrative_block ab ON ST_Intersects(lp.geom, ab.geom)
LIMIT 5;
-- Expected: rows with Nairobi block names

-- Test 2: Entry points are near land parcels
SELECT ep.gid, ep.label, lp.lr_no,
  ST_Distance(ep.geom::geography, lp.geom::geography) AS distance_meters
FROM entry_points ep
JOIN land_parcel lp ON ST_DWithin(ep.geom::geography, lp.geom::geography, 50)
LIMIT 5;
-- Expected: distances under 50m

-- Test 3: Roads are near land parcels
SELECT r.gid, r.name, lp.lr_no,
  ST_Distance(r.geom::geography, lp.geom::geography) AS distance_meters
FROM roads r
JOIN land_parcel lp ON ST_DWithin(r.geom::geography, lp.geom::geography, 100)
LIMIT 5;
-- Expected: Nairobi road names like Uhuru Highway, Haile Selassie Avenue
```

---

## 8. API Reference

**Base URL:** `http://localhost:3000/api`

All coordinates are WGS84 (lat/lng). Slash characters in LR numbers must be URL-encoded as `%2F` in path parameters (e.g. `1/136` → `1%2F136`).

---

### Land Parcels

#### `GET /land-parcel`
Returns paginated list of all land parcels.

**Query params:** `page` (default 1), `limit` (default 50)

```bash
curl "http://localhost:3000/api/land-parcel?page=1&limit=10"
```

---

#### `GET /land-parcel/:gid`
Returns full parcel context: parcel details, entry points with nearest roads, and administrative block.

```bash
curl http://localhost:3000/api/land-parcel/1
```

**Response:**
```json
{
  "parcel": {
    "gid": 1,
    "lr_no": "1/136",
    "fr_no": "85/22",
    "area": 0.031715391,
    "entity": "Complex Shape",
    "centroid": { "lat": -1.2868, "lng": 36.8249 }
  },
  "administrative_block": {
    "gid": 77,
    "name": "NGARA",
    "constituen": "STAREHE",
    "county_nam": "NAIROBI",
    "short_name": "NGARA"
  },
  "entry_points": [
    {
      "gid": 209,
      "label": "73",
      "coordinates": { "lat": -1.2866, "lng": 36.8249 },
      "distance_to_parcel_meters": 3.28,
      "nearest_roads": [
        { "gid": 45524, "name": "Moi Avenue", "fclass": "secondary", "distance_meters": 9.63 }
      ]
    }
  ]
}
```

---

#### `GET /land-parcel/at-point?lat=&lng=`
Returns the GID of the parcel at the given coordinates.

```bash
curl "http://localhost:3000/api/land-parcel/at-point?lat=-1.2868&lng=36.8249"
```

---

#### `POST /land-parcel/identify`
Returns full parcel context for the parcel at the given coordinates.

```bash
curl -X POST http://localhost:3000/api/land-parcel/identify \
  -H "Content-Type: application/json" \
  -d '{"lat": -1.2868, "lng": 36.8249}'
```

---

#### `GET /land-parcel/suggestions?q=`
LR number autocomplete — returns up to 5 matching parcels.

```bash
curl "http://localhost:3000/api/land-parcel/suggestions?q=1/1&limit=5"
```

---

#### `POST /land-parcel/search`
Search parcels by LR number, physical address or proximity.

```bash
curl -X POST http://localhost:3000/api/land-parcel/search \
  -H "Content-Type: application/json" \
  -d '{"lr_no": "1/136"}'

# Search by proximity (1km radius)
curl -X POST http://localhost:3000/api/land-parcel/search \
  -H "Content-Type: application/json" \
  -d '{"lat": -1.2868, "lng": 36.8249, "radius": 1000}'
```

---

#### `GET /land-parcel/tiles/:z/:x/:y.mvt`
Returns a Mapbox Vector Tile for the given tile coordinates. Use with Mapbox GL JS or similar.

```
http://localhost:3000/api/land-parcel/tiles/{z}/{x}/{y}.mvt
```

---

### Roads

#### `GET /roads`
Paginated list of all roads.

```bash
curl "http://localhost:3000/api/roads?page=1&limit=20"
```

---

#### `GET /roads/:gid`
Single road with full GeoJSON geometry.

```bash
curl http://localhost:3000/api/roads/55
```

---

#### `GET /roads/search?name=`
Search roads by name. Optional `fclass` filter.

```bash
curl "http://localhost:3000/api/roads/search?name=Uhuru"
curl "http://localhost:3000/api/roads/search?name=Kenyatta&fclass=secondary"
```

---

#### `GET /roads/nearby?lat=&lng=&radius=`
Roads within radius of a point (default 200m), ordered by distance.

```bash
curl "http://localhost:3000/api/roads/nearby?lat=-1.2868&lng=36.8249&radius=200"
```

---

#### `GET /roads/fclasses`
All road classifications with counts.

```bash
curl http://localhost:3000/api/roads/fclasses
```

**Example response:**
```json
[
  { "fclass": "residential", "count": "18432" },
  { "fclass": "unclassified", "count": "12871" },
  { "fclass": "secondary", "count": "3201" },
  { "fclass": "service", "count": "2918" }
]
```

---

#### `GET /roads/fclass/:fclass`
All roads of a specific classification.

```bash
curl "http://localhost:3000/api/roads/fclass/secondary?page=1&limit=20"
```

---

### Administrative Blocks

#### `GET /administrative-block/counties`
All counties with block counts.

```bash
curl http://localhost:3000/api/administrative-block/counties
```

---

#### `GET /administrative-block/constituencies?county=`
All constituencies, optionally filtered by county.

```bash
curl "http://localhost:3000/api/administrative-block/constituencies?county=NAIROBI"
```

---

#### `GET /administrative-block/search?q=`
Search by block name, constituency or county.

```bash
curl "http://localhost:3000/api/administrative-block/search?q=ngara"
```

---

#### `GET /administrative-block/at-point?lat=&lng=`
Returns the administrative block containing the given coordinates.

```bash
curl "http://localhost:3000/api/administrative-block/at-point?lat=-1.2868&lng=36.8249"
```

---

#### `GET /administrative-block/county/:countyName`
All blocks in a county.

```bash
curl http://localhost:3000/api/administrative-block/county/NAIROBI
```

---

#### `GET /administrative-block/constituency/:constituencyName`
All blocks in a constituency.

```bash
curl http://localhost:3000/api/administrative-block/constituency/STAREHE
```

---

#### `GET /administrative-block/:gid`
Single block with GeoJSON geometry and centroid.

```bash
curl http://localhost:3000/api/administrative-block/1
```

---

### Entry Points

#### `GET /entry-points`
Paginated list of all entry points.

```bash
curl "http://localhost:3000/api/entry-points?page=1&limit=20"
```

---

#### `GET /entry-points/:gid`
Single entry point with GeoJSON geometry.

```bash
curl http://localhost:3000/api/entry-points/1
```

---

#### `GET /entry-points/nearby?lat=&lng=&radius=`
Entry points within radius of a point (default 100m).

```bash
curl "http://localhost:3000/api/entry-points/nearby?lat=-1.2868&lng=36.8249&radius=100"
```

---

#### `GET /entry-points/parcel/:lrNo`
All entry points within 50m of a land parcel.

```bash
curl "http://localhost:3000/api/entry-points/parcel/1%2F136"
```

---

#### `GET /entry-points/:gid/nearest-roads`
Nearest roads to an entry point.

```bash
curl "http://localhost:3000/api/entry-points/1/nearest-roads?radius=100"
```

---

### Address

#### `POST /address/search`
Search by LR number, FR number, admin block name or proximity.

```bash
curl -X POST http://localhost:3000/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"lr_no": "1/136"}'

curl -X POST http://localhost:3000/api/address/search \
  -H "Content-Type: application/json" \
  -d '{"fr_no": "85/22"}'
```

---

#### `GET /address/parcel/:lr_no`
Full address context for a parcel by LR number.

```bash
curl http://localhost:3000/api/address/parcel/1%2F136
```

---

### Routing

#### `POST /routing/calculate`
Calculates the optimal route from origin to a land parcel. Resolves entry points automatically.

```bash
curl -X POST http://localhost:3000/api/routing/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "lat": -1.2921, "lng": 36.8219 },
    "destination_lr_no": "1/136",
    "mode": "driving"
  }'
```

**Transport modes:** `driving`, `walking`, `cycling`, `motorcycle`

---

#### `POST /routing/alternatives`
Returns one route per available entry point.

```bash
curl -X POST http://localhost:3000/api/routing/alternatives \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "lat": -1.2921, "lng": 36.8219 },
    "destination_lr_no": "1/136",
    "mode": "driving"
  }'
```

---

#### `POST /routing/preview`
Quick distance and duration estimate between two coordinate pairs.

```bash
curl -X POST http://localhost:3000/api/routing/preview \
  -H "Content-Type: application/json" \
  -d '{
    "origin": { "lat": -1.2921, "lng": 36.8219 },
    "destination": { "lat": -1.2868, "lng": 36.8249 },
    "mode": "driving"
  }'
```

**Response:**
```json
{
  "distance": 842.3,
  "duration": 187.4,
  "mode": "driving",
  "formatted": {
    "distance": "0.8 km",
    "duration": "4 min"
  }
}
```

---

#### `GET /routing/road-name?lat=&lng=`
Returns the name of the road nearest to the given coordinates via Mapbox.

```bash
curl "http://localhost:3000/api/routing/road-name?lat=-1.2868&lng=36.8249"
```

---

#### `GET /routing/health`
Checks Mapbox API connectivity.

```bash
curl http://localhost:3000/api/routing/health
```

---

## 9. Swagger UI

Interactive API documentation is available at:

```
http://localhost:3000/docs
```

Features:
- Browse all endpoints grouped by module
- Try out requests directly in the browser
- View request/response schemas with examples
- See all available query parameters and body fields

---

## 10. Testing

### Unit tests

```bash
npm run test
npm run test:cov    # With coverage report
npm run test:watch  # Watch mode
```

### E2E tests

```bash
npm run test:e2e
```

### Manual smoke tests

Run these after setup to verify the full stack is working:

```bash
BASE=http://localhost:3000/api

# Land parcels
curl "$BASE/land-parcel" | python3 -m json.tool | head -20
curl "$BASE/land-parcel/1"
curl "$BASE/land-parcel/at-point?lat=-1.2868&lng=36.8249"
curl "$BASE/land-parcel/suggestions?q=1/1"
curl -X POST "$BASE/land-parcel/search" -H "Content-Type: application/json" -d '{"lr_no":"1/136"}'
curl -X POST "$BASE/land-parcel/identify" -H "Content-Type: application/json" -d '{"lat":-1.2868,"lng":36.8249}'

# Roads
curl "$BASE/roads" | python3 -m json.tool | head -20
curl "$BASE/roads/55"
curl "$BASE/roads/fclasses"
curl "$BASE/roads/search?name=Uhuru"
curl "$BASE/roads/nearby?lat=-1.2868&lng=36.8249&radius=200"
curl "$BASE/roads/fclass/secondary"

# Administrative blocks
curl "$BASE/administrative-block/counties"
curl "$BASE/administrative-block/constituencies?county=NAIROBI"
curl "$BASE/administrative-block/search?q=ngara"
curl "$BASE/administrative-block/at-point?lat=-1.2868&lng=36.8249"
curl "$BASE/administrative-block/county/NAIROBI"
curl "$BASE/administrative-block/1"

# Entry points
curl "$BASE/entry-points"
curl "$BASE/entry-points/1"
curl "$BASE/entry-points/nearby?lat=-1.2868&lng=36.8249"
curl "$BASE/entry-points/parcel/1%2F136"
curl "$BASE/entry-points/1/nearest-roads"

# Address
curl "$BASE/address/parcel/1%2F136"
curl -X POST "$BASE/address/search" -H "Content-Type: application/json" -d '{"lr_no":"1/136"}'

# Routing
curl "$BASE/routing/health"
curl "$BASE/routing/road-name?lat=-1.2868&lng=36.8249"
curl -X POST "$BASE/routing/preview" -H "Content-Type: application/json" \
  -d '{"origin":{"lat":-1.2921,"lng":36.8219},"destination":{"lat":-1.2868,"lng":36.8249},"mode":"driving"}'
curl -X POST "$BASE/routing/calculate" -H "Content-Type: application/json" \
  -d '{"origin":{"lat":-1.2921,"lng":36.8219},"destination_lr_no":"1/136","mode":"driving"}'
```

---

## 11. Docker Reference

### Files

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage production build |
| `Dockerfile.dev` | Development image with hot reload |
| `docker-compose.yml` | Dev stack: API + PostGIS |
| `docker-compose.prod.yml` | Production stack |
| `.dockerignore` | Excludes node_modules, dist, .env |

### Commands

```bash
# Development
docker compose up --build          # Start dev stack
docker compose up postgres -d      # Start only DB
docker compose down                # Stop stack
docker compose down -v             # Stop and delete volumes (wipes DB)

# Production
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml down

# Inspect
docker logs Anwani-api              # API logs
docker logs Anwani-postgres         # DB logs
docker exec -it anwani-postgres psql -U Anwani -d anwani_db   # DB shell
```

### Notes

- The PostGIS image used is `postgis/postgis:16-3.4-alpine` — PostGIS is pre-installed, no manual setup needed
- Data volumes persist between restarts; use `down -v` to reset
- In Docker, `DB_HOST` must be `postgres` (the service name), not `localhost`