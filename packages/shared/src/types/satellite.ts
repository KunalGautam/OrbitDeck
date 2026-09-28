export type SatelliteGroup =
  'amateur' | 'weather' | 'stations' | 'gnss' | 'cubesat' | 'military' | 'science' | 'custom';

export interface Satellite {
  noradId: number;
  name: string;
  line1: string;
  line2: string;
  groups: SatelliteGroup[];
  updatedAt: string; // ISO 8601
  isFavorite?: boolean;
  intlDes?: string;
  epochYear?: number;
  epochDay?: number;
  inclinationDeg?: number;
  periodMinutes?: number;
}

export interface SatelliteSummary {
  noradId: number;
  name: string;
  groups: SatelliteGroup[];
  isFavorite: boolean;
  updatedAt: string;
  isStale: boolean;
}

export interface SatelliteFilter {
  query?: string;
  groups?: SatelliteGroup[];
  favoriteOnly?: boolean;
}

export interface TLESource {
  id: string;
  name: string;
  group: SatelliteGroup;
  url: string;
  enabled?: boolean;
  isCustom?: boolean;
  createdAt?: string;
}
