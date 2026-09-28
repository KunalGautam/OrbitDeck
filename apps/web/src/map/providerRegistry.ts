import type { IMapProvider, MapCapabilities, MapProviderId } from '@orbitdeck/shared';

export interface ProviderMetadata {
  id: MapProviderId;
  name: string;
  type: '2D' | '3D';
  description: string;
  capabilities: MapCapabilities;
  loader: () => Promise<IMapProvider>;
}

export const MAP_PROVIDERS: Record<MapProviderId, ProviderMetadata> = {
  leaflet: {
    id: 'leaflet',
    name: 'Leaflet (2D)',
    type: '2D',
    description: 'Lightweight, ultra-fast 2D raster map adhering to OSM tile usage policies.',
    capabilities: {
      supports3D: false,
      supportsVectorTiles: false,
      supportsTerrain: false,
      supportsCustomProjections: true,
      supportsAtmosphere: false,
    },
    loader: async () => {
      const { LeafletAdapter } = await import('./providers/leafletAdapter.js');
      return new LeafletAdapter();
    },
  },
  cesium: {
    id: 'cesium',
    name: 'CesiumJS (3D Globe)',
    type: '3D',
    description: 'Full 3D photorealistic globe with orbital camera and free OpenStreetMap imagery.',
    capabilities: {
      supports3D: true,
      supportsVectorTiles: false,
      supportsTerrain: true,
      supportsCustomProjections: false,
      supportsAtmosphere: true,
    },
    loader: async () => {
      const { CesiumAdapter } = await import('./providers/cesiumAdapter.js');
      return new CesiumAdapter();
    },
  },
};

const STORAGE_KEY = 'orbitdeck.map_provider';

/**
 * Resolves active map provider from:
 * 1. URL search param ?map=leaflet|cesium
 * 2. LocalStorage setting
 * 3. Environment default (VITE_DEFAULT_MAP_PROVIDER)
 * 4. Fallback 'leaflet'
 */
export function getInitialMapProviderId(): MapProviderId {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const urlProvider = params.get('map') as MapProviderId | null;
    if (urlProvider && MAP_PROVIDERS[urlProvider]) {
      return urlProvider;
    }

    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY) as MapProviderId | null;
      if (saved && MAP_PROVIDERS[saved]) {
        return saved;
      }
    }
  }

  const envDefault = (import.meta as any).env?.VITE_DEFAULT_MAP_PROVIDER as
    MapProviderId | undefined;
  if (envDefault && MAP_PROVIDERS[envDefault]) {
    return envDefault;
  }

  return 'leaflet';
}

export function saveMapProviderPreference(providerId: MapProviderId): void {
  if (typeof window !== 'undefined') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, providerId);
    }

    // Update query param in URL without full reload
    const url = new URL(window.location.href);
    url.searchParams.set('map', providerId);
    window.history.replaceState({}, '', url.toString());
  }
}

/**
 * Lazy loads and instantiates the chosen map provider adapter.
 */
export async function loadMapProvider(id: MapProviderId): Promise<IMapProvider> {
  const meta = MAP_PROVIDERS[id];
  if (!meta) {
    throw new Error(`Unknown map provider id: ${id}`);
  }
  return meta.loader();
}
