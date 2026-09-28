import type { MapTileSource } from '@orbitdeck/shared';

export const DEFAULT_TILE_SOURCES: MapTileSource[] = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap Standard (Free)',
    url: '/api/tiles/osm/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: [],
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
    id: 'esri-dark',
    name: 'Esri Dark Gray (Mission Control)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16,
    subdomains: [],
  },
  {
    id: 'opentopomap',
    name: 'OpenTopoMap (Topographic)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    maxZoom: 17,
    subdomains: ['a', 'b', 'c'],
  },
];

export function getTileSourceById(id: string): MapTileSource {
  // Gracefully migrate deprecated or blocked tile sources (e.g. CARTO requiring API keys)
  if (id === 'carto-dark') {
    return DEFAULT_TILE_SOURCES.find((s) => s.id === 'esri-dark') || DEFAULT_TILE_SOURCES[0]!;
  }
  if (id === 'carto-voyager' || id === 'carto-positron') {
    return DEFAULT_TILE_SOURCES[0]!;
  }
  return DEFAULT_TILE_SOURCES.find((s) => s.id === id) || DEFAULT_TILE_SOURCES[0]!;
}
