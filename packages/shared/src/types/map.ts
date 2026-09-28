import type { GroundStation } from './station.js';
import type { CelestialPosition, GroundTrackPoint, LiveTrackingFrame } from './tracking.js';

export type MapProviderId = 'leaflet' | 'openlayers' | 'maplibre' | 'cesium' | 'globegl';

export interface MapCapabilities {
  supports3D: boolean;
  supportsVectorTiles: boolean;
  supportsTerrain: boolean;
  supportsCustomProjections: boolean;
  supportsAtmosphere: boolean;
}

export interface MapTileSource {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  subdomains?: string[];
}

export interface MapMountOptions {
  tileSource?: MapTileSource;
  cesiumIonToken?: string;
  initialCenter?: [number, number]; // [lat, lon]
  initialZoom?: number;
  theme?: 'dark' | 'light';
  attribution?: string;
}

export interface CameraTarget {
  latitude: number;
  longitude: number;
  altitudeKm?: number;
  zoom?: number;
  pitch?: number;
  bearing?: number;
  durationMs?: number;
}

export type SatelliteSelectCallback = (satId: number | null) => void;
export type MapClickCallback = (coords: { latitude: number; longitude: number }) => void;

export interface IMapProvider {
  readonly id: MapProviderId;
  readonly name: string;
  readonly capabilities: MapCapabilities;

  // Lifecycle
  mount(container: HTMLElement, options?: MapMountOptions): Promise<void> | void;
  destroy(): void;
  resize(): void;

  // Rendering
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

  // Interaction
  onSelectSatellite(cb: SatelliteSelectCallback): void;
  onMapClick(cb: MapClickCallback): void;
  flyTo(target: CameraTarget): void;
  followSatellite(satId: number | null): void;
}
