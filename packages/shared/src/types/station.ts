export interface GroundStation {
  id: string;
  name: string;
  latitude: number; // -90 to +90 degrees
  longitude: number; // -180 to +180 degrees
  altitude: number; // meters above sea level
  maidenhead: string; // Maidenhead grid locator (e.g. FN31pr)
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type CreateGroundStationInput = Omit<GroundStation, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateGroundStationInput = Partial<CreateGroundStationInput>;
