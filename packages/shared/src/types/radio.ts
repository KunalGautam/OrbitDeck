export interface Transponder {
  id: string;
  noradId: number;
  description: string;
  uplinkLowHz?: number;
  uplinkHighHz?: number;
  downlinkLowHz?: number;
  downlinkHighHz?: number;
  mode?: string; // e.g. FM, SSB, CW, APRS, FSK9600
  baud?: number;
  invert?: boolean;
  alive?: boolean;
}

export interface DopplerCalculation {
  transponderId: string;
  frequencyHz: number;
  dopplerShiftHz: number;
  correctedFrequencyHz: number;
  rangeRateKmS: number;
}

export interface HamlibConfig {
  enabled: boolean;
  rigHost: string;
  rigPort: number;
  rotHost: string;
  rotPort: number;
  updateIntervalMs: number;
}

export interface HamlibStatus {
  connectedRig: boolean;
  connectedRot: boolean;
  currentAzimuth?: number;
  currentElevation?: number;
  targetAzimuth?: number;
  targetElevation?: number;
  rigFrequencyHz?: number;
  lastUpdated?: number;
}
