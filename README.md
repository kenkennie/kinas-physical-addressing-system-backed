# Anwani Physical Addressing API

A NestJS REST API for Kenya's physical addressing system — managing land parcels, roads, administrative blocks, entry points, and address generation with PostGIS spatial support.

## Tech Stack

- **NestJS** — Node.js framework
- **TypeORM** — ORM with PostgreSQL/PostGIS
- **Mapbox SDK** — Routing & geocoding
- **Docker + Docker Compose** — Containerised environments

---

## Getting Started

### Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)

### Environment Setup

```bash
cp .env.example .env
# Edit .env and fill in your values
```

---

## Running the App

### With Docker (recommended)

**Development** — hot reload enabled:

```bash
npm run docker:dev
# or
docker compose up --build
```

**Production:**

```bash
npm run docker:prod
# or
docker compose -f docker-compose.prod.yml up --build -d
```

**Tear down:**

```bash
npm run docker:dev:down   # development
npm run docker:prod:down  # production
```

### Without Docker

```bash
npm install
npm run start:dev
```

---

## API

All routes are prefixed with `/api`.

| Module              | Base Path                  |
|---------------------|---------------------------|
| Land Parcels        | `/api/land-parcel`        |
| Roads               | `/api/roads`              |
| Administrative Blocks | `/api/administrative-block` |
| Entry Points        | `/api/entry-points`       |
| Address             | `/api/address`            |
| Routing             | `/api/routing`            |

---

## Project Structure

```
src/
├── address/                  # Address generation
├── administrative-block/     # Administrative block management
├── common/utils/             # Shared utilities (geometry, address gen)
├── config/                   # Database & app configuration
├── entry-points/             # Entry point management
├── land-parcel/              # Land parcel management
├── roads/                    # Road management
├── routing/                  # Mapbox-powered routing
├── app.module.ts
└── main.ts
```

---

## Scripts

```bash
npm run start:dev       # Start with hot reload
npm run build           # Compile TypeScript
npm run test            # Unit tests
npm run test:cov        # Coverage report
npm run lint            # Lint & auto-fix
npm run docker:dev      # Docker dev environment
npm run docker:prod     # Docker production environment
```