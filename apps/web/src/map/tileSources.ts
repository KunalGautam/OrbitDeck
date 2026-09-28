import type { MapTileSource } from '@orbitdeck/shared';

export const DEFAULT_TILE_SOURCES: MapTileSource[] = [
  {
    id: 'osm-standard',
    name: 'OpenStreetMap (Standard)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
  },
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
    id: 'carto-voyager',
    name: 'CARTO Voyager (Clean Light)',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
];

export function getTileSourceById(id: string): MapTileSource {
  return DEFAULT_TILE_SOURCES.find((s) => s.id === id) || DEFAULT_TILE_SOURCES[0]!;
}
