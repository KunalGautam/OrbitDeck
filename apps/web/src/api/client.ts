import type {
  CreateGroundStationInput,
  GroundStation,
  PassPrediction,
  PassQueryOptions,
  Satellite,
  SatelliteFilter,
  TimeControlAction,
  TimeControlState,
  Transponder,
  UpdateGroundStationInput,
} from '@orbitdeck/shared';

const API_BASE = '/api';

export async function fetchSatellites(
  filter?: SatelliteFilter & { limit?: number; offset?: number },
): Promise<{ satellites: (Satellite & { isStale: boolean })[]; total: number }> {
  const params = new URLSearchParams();
  if (filter?.query) params.set('query', filter.query);
  if (filter?.groups && filter.groups.length > 0) params.set('group', filter.groups[0]!);
  if (filter?.favoriteOnly) params.set('favoriteOnly', 'true');
  if (filter?.limit) params.set('limit', String(filter.limit));
  if (filter?.offset) params.set('offset', String(filter.offset));

  const res = await fetch(`${API_BASE}/satellites?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch satellites');
  return res.json();
}

export async function fetchSatelliteById(
  noradId: number,
): Promise<Satellite & { isStale: boolean }> {
  const res = await fetch(`${API_BASE}/satellites/${noradId}`);
  if (!res.ok) throw new Error('Satellite not found');
  return res.json();
}

export async function toggleFavorite(noradId: number, isFavorite: boolean): Promise<void> {
  const res = await fetch(`${API_BASE}/satellites/${noradId}/favorite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isFavorite }),
  });
  if (!res.ok) throw new Error('Failed to toggle favorite');
}

export async function refreshTLE(): Promise<{ updated: number; message: string }> {
  const res = await fetch(`${API_BASE}/tle/refresh`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to refresh TLE data');
  return res.json();
}

export async function fetchStations(): Promise<GroundStation[]> {
  const res = await fetch(`${API_BASE}/stations`);
  if (!res.ok) throw new Error('Failed to fetch ground stations');
  const data = await res.json();
  return data.stations;
}

export async function createStation(input: CreateGroundStationInput): Promise<GroundStation> {
  const res = await fetch(`${API_BASE}/stations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create ground station');
  return res.json();
}

export async function updateStation(
  id: string,
  input: UpdateGroundStationInput,
): Promise<GroundStation> {
  const res = await fetch(`${API_BASE}/stations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update ground station');
  return res.json();
}

export async function deleteStation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete ground station');
}

export async function setDefaultStation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stations/${id}/default`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to set default ground station');
}

export async function fetchGroundTrack(
  noradId: number,
  pastOrbits: number = 0.5,
  futureOrbits: number = 1.0,
): Promise<{
  points: { latitude: number; longitude: number; altitudeKm: number; timestamp: number }[];
}> {
  const res = await fetch(
    `${API_BASE}/tracking/${noradId}/track?pastOrbits=${pastOrbits}&futureOrbits=${futureOrbits}&stepSeconds=45`,
  );
  if (!res.ok) throw new Error('Failed to fetch ground track');
  return res.json();
}

export async function fetchPasses(
  options: PassQueryOptions,
): Promise<{ passes: PassPrediction[]; totalPasses: number }> {
  const params = new URLSearchParams({
    noradId: String(options.noradId),
    stationId: options.stationId,
    daysAhead: String(options.daysAhead ?? 3),
    minElevationDeg: String(options.minElevationDeg ?? 10),
  });
  const res = await fetch(`${API_BASE}/passes?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch passes');
  return res.json();
}

export async function fetchTransponders(
  noradId: number,
  stationId?: string,
): Promise<{
  transponders: (Transponder & {
    uplinkShiftHz?: number;
    uplinkCorrectedHz?: number;
    downlinkShiftHz?: number;
    downlinkCorrectedHz?: number;
  })[];
  rangeRateKmS: number;
  elevationDeg?: number;
  azimuthDeg?: number;
}> {
  const params = stationId ? `?stationId=${stationId}` : '';
  const res = await fetch(`${API_BASE}/radio/${noradId}/transponders${params}`);
  if (!res.ok) throw new Error('Failed to fetch transponders');
  return res.json();
}

export async function fetchTimeState(): Promise<TimeControlState> {
  const res = await fetch(`${API_BASE}/time`);
  if (!res.ok) throw new Error('Failed to fetch time state');
  return res.json();
}

export async function sendTimeAction(action: TimeControlAction): Promise<TimeControlState> {
  const res = await fetch(`${API_BASE}/time/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error('Failed to send time action');
  return res.json();
}

export async function fetchHamlibStatus(): Promise<{
  config: import('@orbitdeck/shared').HamlibConfig;
  status: import('@orbitdeck/shared').HamlibStatus;
}> {
  const res = await fetch(`${API_BASE}/hamlib/status`);
  if (!res.ok) throw new Error('Failed to fetch Hamlib status');
  return res.json();
}

export async function setHamlibRotator(
  azimuthDeg: number,
  elevationDeg: number,
): Promise<{ success: boolean; azimuthDeg: number; elevationDeg: number }> {
  const res = await fetch(`${API_BASE}/hamlib/rotator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azimuthDeg, elevationDeg }),
  });
  if (!res.ok) throw new Error('Failed to set rotator position');
  return res.json();
}

export async function setHamlibFrequency(
  frequencyHz: number,
): Promise<{ success: boolean; frequencyHz: number }> {
  const res = await fetch(`${API_BASE}/hamlib/frequency`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frequencyHz }),
  });
  if (!res.ok) throw new Error('Failed to set radio frequency');
  return res.json();
}
