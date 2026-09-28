export interface SatelliteTable {
  norad_id: number;
  name: string;
  line1: string;
  line2: string;
  groups: string; // JSON string array: ["amateur", "weather"]
  updated_at: string; // ISO 8601 string
  is_favorite: number; // 0 or 1
  intl_des: string | null;
  epoch_year: number | null;
  epoch_day: number | null;
  inclination_deg: number | null;
  period_minutes: number | null;
}

export interface GroundStationTable {
  id: string; // UUID
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  maidenhead: string;
  is_default: number; // 0 or 1
  is_protected?: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface CustomGroupTable {
  id: string;
  name: string;
  satellite_ids: string; // JSON array of numbers
  created_at: string;
}

export interface SettingTable {
  key: string;
  value: string; // JSON serialized string
  updated_at: string;
}

export interface Database {
  satellites: SatelliteTable;
  ground_stations: GroundStationTable;
  custom_groups: CustomGroupTable;
  settings: SettingTable;
}
