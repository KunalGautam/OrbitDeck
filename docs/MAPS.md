# OrbitDeck Map Provider Architecture & Integration Guide

OrbitDeck features a modular map provider abstraction layer that enables switching between 2D and 3D map engines at runtime without page reloads.

## Supported Providers

| Provider     | Type            | Capabilities                                  | Default Imagery                    |
| ------------ | --------------- | --------------------------------------------- | ---------------------------------- |
| **Leaflet**  | 2D Raster       | Lightweight, fast pan/zoom, strict OSM policy | OpenStreetMap Standard (100% Free) |
| **CesiumJS** | 3D Globe / 2.5D | Full 3D globe, orbital camera, atmosphere     | OpenStreetMap Standard (100% Free) |

## Adapter Contract (`IMapProvider`)

Each provider implements `IMapProvider` defined in `@orbitdeck/shared`:

```typescript
export interface IMapProvider {
  readonly id: MapProviderId;
  readonly name: string;
  readonly capabilities: MapCapabilities;

  mount(container: HTMLElement, options?: MapMountOptions): Promise<void> | void;
  destroy(): void;
  resize(): void;

  setSatellites(frames: LiveTrackingFrame[]): void;
  setGroundTrack(satId: number, points: GroundTrackPoint[]): void;
  clearGroundTrack(satId?: number): void;
  setFootprint(
    satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void;
  clearFootprint(satId?: number): void;
  setStation(station: GroundStation | null): void;
  setTerminator(polygon: [number, number][][]): void;
  setSunMoon(positions: CelestialPosition[]): void;

  onSelectSatellite(cb: SatelliteSelectCallback): void;
  onMapClick(cb: MapClickCallback): void;
  flyTo(target: CameraTarget): void;
  followSatellite(satId: number | null): void;
}
```

## Antimeridian Handling

In 2D equirectangular and Mercator projections, objects traversing the $\pm 180^\circ$ meridian create visual anomalies if drawn as unbroken lines. OrbitDeck provides:

1. `splitTrackAtAntimeridian`: Automatically splits orbital paths into segments at the $-180^\circ / +180^\circ$ transition.
2. `splitPolygonAtAntimeridian`: Automatically divides footprint circles crossing the antimeridian into disjoint polygons.

All adapters utilize these utilities so no visual wrapping streaks appear.

## Tile Usage Policy and Attribution

- **OpenStreetMap Standard Tiles**: Strictly adheres to the [OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/):
  - OrbitDeck sends custom user-agent headers in API proxies where applicable.
  - Bulk prefetching is disallowed.
  - Attribution is rendered visibly (`© OpenStreetMap contributors`).
- **Custom XYZ Tile Sources**: Users can configure any custom tile server (including self-hosted tile servers) in the map settings dialog or via `VITE_CUSTOM_TILE_URL`.

## Adding a New Map Provider

1. Create a new adapter file in `apps/web/src/map/providers/<name>Adapter.ts`.
2. Implement the `IMapProvider` interface.
3. Register the provider in `apps/web/src/map/providerRegistry.ts`.
4. Run the shared conformance test suite (`apps/web/src/map/conformance.test.ts`) to verify mount, destroy, track, footprint, and selection callbacks.
