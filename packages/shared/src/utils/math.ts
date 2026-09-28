export const EARTH_RADIUS_KM = 6371.0;
export const SPEED_OF_LIGHT_KM_S = 299792.458;

/**
 * Calculates the footprint radius (visibility circle radius on Earth surface) in km.
 * @param altitudeKm Satellite altitude above sea level in km
 */
export function calculateFootprintRadiusKm(altitudeKm: number): number {
  if (altitudeKm <= 0) return 0;
  // Angular radius theta from satellite to horizon
  // cos(theta) = R_earth / (R_earth + h)
  const cosTheta = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm);
  const theta = Math.acos(Math.min(1, Math.max(0, cosTheta)));
  return EARTH_RADIUS_KM * theta;
}

/**
 * Calculates Doppler shifted frequency.
 * @param nominalFreqHz Transmitter frequency in Hz
 * @param rangeRateKmS Range rate in km/s (negative when approaching, positive when receding)
 * @returns Shift in Hz and resulting received frequency in Hz
 */
export function calculateDopplerShift(
  nominalFreqHz: number,
  rangeRateKmS: number,
): { shiftHz: number; receivedFreqHz: number } {
  // f_rx = f_tx * (1 - v_r / c)
  const ratio = rangeRateKmS / SPEED_OF_LIGHT_KM_S;
  const shiftHz = -nominalFreqHz * ratio;
  const receivedFreqHz = nominalFreqHz + shiftHz;
  return {
    shiftHz: Math.round(shiftHz * 100) / 100,
    receivedFreqHz: Math.round(receivedFreqHz * 100) / 100,
  };
}

/**
 * Haversine distance in km between two lat/lon points on Earth.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculates initial bearing in degrees (0..360) from point 1 to point 2.
 */
export function calculateBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  const bearing = ((theta * 180) / Math.PI + 360) % 360;
  return bearing;
}
