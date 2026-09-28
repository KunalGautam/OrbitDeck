# OrbitDeck 🛰️

[![OrbitDeck CI](https://github.com/orbitdeck/orbitdeck/actions/workflows/ci.yml/badge.svg)](https://github.com/orbitdeck/orbitdeck/actions/workflows/ci.yml)
[![Version](https://img.shields.io/badge/version-v1.0.0-cyan.svg)](https://github.com/orbitdeck/orbitdeck)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**OrbitDeck** is a modern, web-based satellite tracking, orbit visualization, and pass-prediction utility inspired by **Gpredict**. Built with **TypeScript**, **Node.js**, **Express**, and **React (Vite)**, it delivers real-time SGP4 orbital propagation, a runtime-pluggable 2D/3D map engine, polar az/el radar tracking, SatNOGS transponder Doppler calculations, and a Hamlib TCP bridge for rotor and rig automation.

---

## 🌟 Key Features

### 🗺️ Multi-Engine Map Architecture (Runtime Selectable)

Switch seamlessly between **5 different map engines** at runtime without reloading the page or losing state:

- **Leaflet (2D)**: Ultra-fast, lightweight 2D raster default.
- **OpenLayers (2D)**: Advanced projections and smooth vector layer rendering.
- **MapLibre GL (2D)**: Hardware-accelerated WebGL vector tiles with fluid rotation.
- **CesiumJS (3D)**: Photorealistic 3D virtual globe with atmospheric scattering, orbital camera, and night lighting (runs out of the box with free OSM tiles; optional Cesium Ion support).
- **Globe.gl (3D)**: Lightweight Three.js-based interactive 3D globe.
- **Antimeridian Safety**: Proprietary splitting algorithms (`splitTrackAtAntimeridian` and `splitPolygonAtAntimeridian`) prevent line wrapping artifacts across the $\pm 180^\circ$ meridian.

### 🔭 Mission Control Dashboard & Views

- **Multi-Panel Gpredict Layout**: Live 2D/3D map, polar radar sky plot, kinematic telemetry cards, and searchable satellite list in a single unified view.
- **Polar Radar Sky Plot**: Real-time azimuth/elevation radar chart displaying target passes, current satellite position, cardinal markers, and sub-solar/sub-lunar positions.
- **Real-Time Kinematics**: Sub-satellite coordinates (WGS-84), altitude, orbital velocity, slant range, range rate, az/el, footprint diameter, eclipse status (sunlit, penumbra, umbra), and raw two-line element set (TLE) drawer.
- **Pass Prediction Engine**: Multi-day pass calculations (AOS, LOS, Peak Elevation, Duration, Azimuths, Optical Visibility: Visible / Daylight / Eclipsed) with one-click export to **iCal (`.ics`)** and **CSV**.
- **Radio & Live Doppler Tuning**: SatNOGS DB transmitter database integration with real-time Doppler shift computations ($\pm\text{Hz}$) for uplink/downlink frequencies and direct Hamlib tuning.
- **QTH Ground Station Manager**: Full Maidenhead Grid Square (QTH Locator) auto-computation with browser geolocation integration.
- **Time Controller**: Simulation engine with Pause/Resume, Speed Multipliers ($1\times, 2\times, 5\times, 10\times, 60\times, 300\times$), time jumping, and instant sync back to real-time wall clock.

### ⚙️ Multi-Engine Database Layer

- **SQLite (Default)**: Zero-config operation powered by Node's built-in `node:sqlite` (`DatabaseSync`), bypassing native C++ node-gyp compilation issues.
- **PostgreSQL**: Production-grade persistence via `pg` and Kysely dialect.
- **MySQL / MariaDB**: Fully supported via `mysql2` and Kysely dialect.
- **Automated Versioned Migrations**: Runs schema migrations idempotently on startup.

### 📡 Automated TLE Synchronization & Hardware Bridge

- **CelesTrak Synchronization**: Auto-fetches NORAD orbital elements grouped by mission (Space Stations, Amateur, Weather, GNSS, CubeSats).
- **Offline Fallback Cache**: Embedded verified default TLE catalogue ensures instant offline functionality.
- **Hamlib TCP Bridge**: Connects to `rotctld` (antenna azimuth/elevation rotators) and `rigctld` (radio transceivers) for automated satellite pass tracking.

---

## 🏗️ Monorepo Architecture

OrbitDeck is structured as an npm workspaces monorepo:

```
sat-tracker/
├── apps/
│   ├── api/                  # Node.js + Express + SGP4 + WebSocket backend
│   │   ├── src/
│   │   │   ├── db/           # Kysely multi-engine migrations & repositories
│   │   │   ├── routes/       # Express REST endpoints
│   │   │   ├── services/     # SGP4, TLE, Passes, Radio, Hamlib, TimeController
│   │   │   └── websocket/    # 1 Hz live telemetry broadcast server
│   └── web/                  # React + Vite + TailwindCSS frontend
│       ├── src/
│       │   ├── components/   # Mission Control panels, modals, polar plot
│       │   ├── context/      # OrbitDeck React Context & WebSocket client
│       │   └── map/          # IMapProvider adapters (Leaflet, OL, MapLibre, Cesium, Globe.gl)
├── packages/
│   └── shared/               # Shared domain contracts, Zod schemas, Maidenhead & math utils
├── docker/
│   ├── Dockerfile            # Multi-stage production container (< 250 MB)
│   └── docker-compose.yml    # Profiles for SQLite, PostgreSQL, and MySQL
├── docs/
│   ├── DECISIONS.md          # Architecture Decision Records (ADR-001 to ADR-008)
│   └── MAPS.md               # Map adapter specification & integration guide
└── .github/
    └── workflows/ci.yml      # GitHub Actions CI workflow (lint, typecheck, test, build)
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or 22.x
- npm 10.x or higher

### 1. Local Development

```bash
# Clone the repository
git clone https://github.com/orbitdeck/orbitdeck.git
cd orbitdeck

# Install all monorepo dependencies
npm install

# Run the complete test suite (82+ unit & conformance tests)
npm test

# Start backend API (port 3001) and web frontend (port 3000) concurrently
npm run dev
```

Open your browser to [http://localhost:3000](http://localhost:3000).

---

## 🐳 Docker Deployment

### Default: Zero-Configuration SQLite

OrbitDeck runs out-of-the-box with SQLite and persistent volumes:

```bash
docker compose -f docker/docker-compose.yml up -d
```

The web application and API are available immediately at [http://localhost:3000](http://localhost:3000).

### PostgreSQL Profile

To run OrbitDeck with a dedicated PostgreSQL 16 database:

```bash
docker compose -f docker/docker-compose.yml --profile postgres up -d
```

### MySQL Profile

To run OrbitDeck with MySQL 8.0:

```bash
docker compose -f docker/docker-compose.yml --profile mysql up -d
```

---

## 📡 API Reference

| Endpoint                       | Method   | Description                                                         |
| ------------------------------ | -------- | ------------------------------------------------------------------- |
| `/api/health`                  | `GET`    | Healthcheck and timestamp                                           |
| `/api/satellites`              | `GET`    | List satellites with query, group, and favorite filtering           |
| `/api/satellites/:id`          | `GET`    | Fetch single satellite metadata and TLE                             |
| `/api/satellites/:id/favorite` | `POST`   | Toggle satellite favorite status                                    |
| `/api/tle/refresh`             | `POST`   | Trigger background TLE refresh from CelesTrak                       |
| `/api/stations`                | `GET`    | List saved ground stations (QTH)                                    |
| `/api/stations`                | `POST`   | Create new ground station with Maidenhead locator                   |
| `/api/stations/:id`            | `PUT`    | Update ground station coordinates/elevation                         |
| `/api/stations/:id`            | `DELETE` | Remove ground station                                               |
| `/api/tracking/:id`            | `GET`    | Calculate current sub-satellite position and kinematics             |
| `/api/tracking/:id/track`      | `GET`    | Calculate past/future ground track trajectory points                |
| `/api/passes`                  | `GET`    | Compute upcoming passes for satellite and station                   |
| `/api/passes/export`           | `GET`    | Export pass predictions to iCalendar (`.ics`) or CSV                |
| `/api/radio/:id/transponders`  | `GET`    | Fetch SatNOGS transponders with live Doppler shift                  |
| `/api/hamlib/status`           | `GET`    | Retrieve Hamlib rigctld/rotctld connection state                    |
| `/api/hamlib/rotator`          | `POST`   | Command rotator azimuth/elevation via Hamlib                        |
| `/api/hamlib/frequency`        | `POST`   | Set radio transceiver frequency via Hamlib                          |
| `/api/time`                    | `GET`    | Retrieve simulation clock state                                     |
| `/api/time/action`             | `POST`   | Dispatch clock actions (`PAUSE`, `RESUME`, `SET_SPEED`, `SET_TIME`) |
| `/ws`                          | `WSS`    | 1 Hz live telemetry broadcast stream                                |

---

## 🔧 Environment Variables

| Variable            | Default                   | Description                                            |
| ------------------- | ------------------------- | ------------------------------------------------------ |
| `PORT`              | `3001`                    | HTTP server port                                       |
| `HOST`              | `0.0.0.0`                 | Network binding host                                   |
| `NODE_ENV`          | `development`             | Application environment (`development` / `production`) |
| `DB_ENGINE`         | `sqlite`                  | Database engine (`sqlite`, `postgres`, `mysql`)        |
| `DB_PATH`           | `./data/orbitdeck.sqlite` | SQLite database file path                              |
| `DB_HOST`           | `localhost`               | Database host (PostgreSQL / MySQL)                     |
| `DB_PORT`           | `5432` / `3306`           | Database port (PostgreSQL / MySQL)                     |
| `DB_NAME`           | `orbitdeck`               | Database name                                          |
| `DB_USER`           | `orbitdeck`               | Database username                                      |
| `DB_PASSWORD`       | `—`                       | Database password                                      |
| `TLE_AUTO_REFRESH`  | `true`                    | Enable automated daily CelesTrak synchronization       |
| `TLE_CRON_SCHEDULE` | `0 0 * * *`               | Cron schedule for TLE synchronization                  |
| `HAMLIB_ENABLED`    | `false`                   | Enable Hamlib hardware tracking                        |
| `HAMLIB_RIG_HOST`   | `localhost`               | `rigctld` host address                                 |
| `HAMLIB_RIG_PORT`   | `4532`                    | `rigctld` TCP port                                     |
| `HAMLIB_ROT_HOST`   | `localhost`               | `rotctld` host address                                 |
| `HAMLIB_ROT_PORT`   | `4533`                    | `rotctld` TCP port                                     |

---

## 🧪 Testing & Quality Assurance

OrbitDeck maintains strict code quality standards:

```bash
# Run all tests across shared, api, and web packages
npm test

# Run TypeScript type check across all workspaces
npm run typecheck

# Run ESLint & Prettier
npm run lint

# Build all production targets
npm run build
```

---

## 📄 License

OrbitDeck is open-source software licensed under the [MIT License](LICENSE).
