# OrbitDeck 🛰️

> Web-based satellite tracking and pass-prediction utility inspired by Gpredict.

## Architecture

- **`packages/shared`**: Shared TypeScript types, Zod schemas, Maidenhead locator conversions, coordinate math, and the `MapProvider` abstraction contract.
- **`apps/api`**: Node.js + Express (TypeScript) backend providing SGP4 propagation (`satellite.js`), TLE synchronization from CelesTrak, pass prediction, SatNOGS transponder queries, Hamlib TCP bridge, and live WebSocket telemetry broadcasting.
- **`apps/web`**: React (TypeScript, Vite) frontend featuring modular dashboard views (Map, Polar az/el radar, Single Satellite Detail, Satellite List, Pass Predictions, Doppler Radio tuning) and runtime switchable map providers (Leaflet, OpenLayers, MapLibre GL, CesiumJS, globe.gl).
- **`docker/`**: Multi-stage Docker and Docker Compose definitions for SQLite, PostgreSQL, and MySQL.

## Quick Start

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Build all packages and applications
npm run build

# Start API and Web in development mode
npm run dev
```
