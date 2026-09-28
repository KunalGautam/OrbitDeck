export type EclipseStatus = 'sunlit' | 'penumbra' | 'umbra';

export interface GeoPoint {
  latitude: number; // degrees [-90, 90]
  longitude: number; // degrees [-180, 180]
  altitudeKm: number;
}

export interface GroundTrackPoint {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  timestamp: number; // epoch ms
}

export interface LiveTrackingFrame {
  noradId: number;
  name: string;
  timestamp: number; // epoch ms
  latitude: number; // sub-satellite point degrees [-90, 90]
  longitude: number; // sub-satellite point degrees [-180, 180]
  altitudeKm: number;
  velocityKmS: number;
  footprintRadiusKm: number;
  eclipseStatus: EclipseStatus;

  // Relative to selected station (if provided)
  stationId?: string;
  azimuthDeg?: number; // 0 to 360 degrees
  elevationDeg?: number; // -90 to +90 degrees
  rangeKm?: number;
  rangeRateKmS?: number; // negative = approaching, positive = receding
}

export interface CelestialPosition {
  type: 'sun' | 'moon';
  latitude: number; // sub-solar / sub-lunar point
  longitude: number;
  azimuthDeg?: number;
  elevationDeg?: number;
}
