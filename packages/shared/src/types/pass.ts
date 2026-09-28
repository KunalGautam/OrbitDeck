export type PassVisibility = 'daylight' | 'visible' | 'eclipsed';

export interface PassPoint {
  timestamp: number; // epoch ms
  azimuthDeg: number;
  elevationDeg: number;
  rangeKm: number;
  latitude: number;
  longitude: number;
  altitudeKm: number;
  isEclipsed: boolean;
}

export interface PassPrediction {
  id: string;
  noradId: number;
  satelliteName: string;
  stationId: string;
  stationName: string;
  aosTime: number; // Acquisition of Signal (epoch ms)
  losTime: number; // Loss of Signal (epoch ms)
  maxElTime: number; // Peak elevation time (epoch ms)
  maxElevationDeg: number; // Max elevation in degrees
  aosAzimuthDeg: number; // Azimuth at AOS
  losAzimuthDeg: number; // Azimuth at LOS
  durationSeconds: number;
  visibility: PassVisibility;
  points?: PassPoint[]; // Trajectory points during pass
}

export interface PassQueryOptions {
  noradId: number;
  stationId: string;
  daysAhead?: number; // default 3 days
  minElevationDeg?: number; // default 0 or 10 degrees
  stepSeconds?: number; // trajectory sampling rate
}

export type PassExportFormat = 'ics' | 'csv' | 'json';
