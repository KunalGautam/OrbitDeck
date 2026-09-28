# Architecture Decision Records (ADR) - OrbitDeck

## ADR-001: Monorepo Architecture and Package Layout

- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: OrbitDeck requires a TypeScript backend (Express API), TypeScript frontend (React + Vite), and shared contracts (types, schemas, coordinate math).
- **Decision**: Use npm workspaces with `packages/shared`, `apps/api`, `apps/web`.
- **Consequences**:
  - Direct type sharing without publishing packages.
  - Consistent TypeScript configuration and linting across apps.

## ADR-002: Database Layer and Multi-Engine Strategy

- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: The application must run zero-config out of the box on SQLite, while seamlessly supporting PostgreSQL and MySQL/MariaDB in production through environment variables (`DB_DRIVER=sqlite|postgres|mysql`).
- **Decision**: Adopt a repository pattern with Kysely (or Drizzle with dialect drivers) and raw SQL migration files executed automatically at startup. Repositories return pure domain models, so services and HTTP routes have no coupling to database drivers.
- **Consequences**:
  - Easy testing using in-memory or temporary SQLite.
  - Production deployments can switch to PostgreSQL or MySQL with no code changes.

## ADR-003: Map Provider Adapter Pattern

- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Gpredict users need rich map views. Some prefer fast lightweight 2D (Leaflet, OpenLayers), some want smooth vector rendering (MapLibre GL), and others want 3D globe visualization (CesiumJS, globe.gl).
- **Decision**: Build an explicit `IMapProvider` adapter contract in `@orbitdeck/shared`. Each provider is implemented as an isolated class lazy-loaded via dynamic `import()`. Map view state (selected satellite, followed satellite, camera position) is maintained in React state and synchronized when switching adapters at runtime.
- **Consequences**:
  - Zero bloated initial bundle; 3D globe engines (Cesium / globe.gl) are only fetched over the network if selected.
  - Conformance test suite guarantees identical behavior across all adapters.

## ADR-004: Orbit Propagation and Pass Prediction

- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Real-time position tracking and pass prediction must match Gpredict accuracy.
- **Decision**: Use `satellite.js` (standard SGP4/SDP4 orbital propagator) combined with astronomical algorithms for Sun/Moon position and eclipse calculation (umbra/penumbra/sunlit).
- **Consequences**:
  - Industry-standard accuracy matching NORAD TLE specifications.
  - Deterministic pass predictions with AOS/LOS/Max Elevation and visibility conditions.

## ADR-005: Real-time Communication

- **Date**: 2026-09-28
- **Status**: Accepted
- **Context**: Live tracking updates at 1 Hz (or configurable) need low overhead and low latency.
- **Decision**: Standard native WebSocket (`ws`) server with JSON message framing. Clients can also send time control signals (pause, speed multiplier, jump-to-time).
- **Consequences**:
  - Minimal protocol overhead compared to HTTP polling.
  - Shared simulation clock state across map, polar plot, and telemetry table.
