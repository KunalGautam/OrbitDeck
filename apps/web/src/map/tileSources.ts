import type { MapTileSource } from '@orbitdeck/shared';

export const DEFAULT_TILE_SOURCES: MapTileSource[] = [
  {
    id: 'carto-dark',
    name: 'CARTO Dark Matter (Mission Control)',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'esri-satellite',
    name: 'Esri World Imagery (Satellite Photorealistic)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
    subdomains: [],
  },
  {
    id: 'carto-voyager',
    name: 'CARTO Voyager (Clean Light)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'carto-positron',
    name: 'CARTO Positron (Minimal Light)',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
];

export function getTileSourceById(id: string): MapTileSource {
  // Gracefully migrate deprecated or blocked tile sources
  if (id === 'osm-standard') {
    return DEFAULT_TILE_SOURCES[0]!;
  }
  return DEFAULT_TILE_SOURCES.find((s) => s.id === id) || DEFAULT_TILE_SOURCES[0]!;
}
