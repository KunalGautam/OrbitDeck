/**
 * Maidenhead Grid Locator (QTH Locator) System implementation
 * Converts between latitude/longitude and Maidenhead locators (e.g. "FN31pr" <-> 41.729, -72.687)
 */

export interface LatLon {
  latitude: number;
  longitude: number;
}

/**
 * Converts Latitude and Longitude to Maidenhead Locator string.
 * @param lat Latitude (-90 to +90)
 * @param lon Longitude (-180 to +180)
 * @param precision Character length: 4 (e.g. FN31), 6 (e.g. FN31pr), 8 (e.g. FN31pr12)
 */
export function latLonToMaidenhead(lat: number, lon: number, precision: 4 | 6 | 8 = 6): string {
  // Clamp lat and lon
  const clampedLat = Math.min(90, Math.max(-90, lat));
  const clampedLon = Math.min(180, Math.max(-180, lon));

  // Shift to positive coordinate system: lon in [0, 360), lat in [0, 180)
  let adjustedLon = clampedLon + 180;
  let adjustedLat = clampedLat + 90;

  // Handle edge cases at maximum boundaries
  if (adjustedLon >= 360) adjustedLon = 359.999999;
  if (adjustedLat >= 180) adjustedLat = 179.999999;

  // Field (pairs of letters A-R, 20 deg lon x 10 deg lat)
  const fieldLon = Math.floor(adjustedLon / 20);
  const fieldLat = Math.floor(adjustedLat / 10);
  const char1 = String.fromCharCode('A'.charCodeAt(0) + fieldLon);
  const char2 = String.fromCharCode('A'.charCodeAt(0) + fieldLat);

  let remLon = adjustedLon % 20;
  let remLat = adjustedLat % 10;

  // Square (pairs of digits 0-9, 2 deg lon x 1 deg lat)
  const squareLon = Math.floor(remLon / 2);
  const squareLat = Math.floor(remLat / 1);
  const char3 = String.fromCharCode('0'.charCodeAt(0) + squareLon);
  const char4 = String.fromCharCode('0'.charCodeAt(0) + squareLat);

  if (precision === 4) {
    return `${char1}${char2}${char3}${char4}`;
  }

  remLon = remLon % 2;
  remLat = remLat % 1;

  // Subsquare (pairs of letters a-x, 5 min lon x 2.5 min lat -> 24 divs)
  // 2 degrees = 120 arcmin, / 24 = 5 arcmin = 0.083333 deg
  // 1 degree = 60 arcmin, / 24 = 2.5 arcmin = 0.041667 deg
  const subLon = Math.floor(remLon / (2 / 24));
  const subLat = Math.floor(remLat / (1 / 24));
  const char5 = String.fromCharCode('a'.charCodeAt(0) + subLon);
  const char6 = String.fromCharCode('a'.charCodeAt(0) + subLat);

  if (precision === 6) {
    return `${char1}${char2}${char3}${char4}${char5}${char6}`;
  }

  remLon = remLon % (2 / 24);
  remLat = remLat % (1 / 24);

  // Extended square (pairs of digits 0-9)
  const extLon = Math.floor(remLon / (2 / 240));
  const extLat = Math.floor(remLat / (1 / 240));
  const char7 = String.fromCharCode('0'.charCodeAt(0) + extLon);
  const char8 = String.fromCharCode('0'.charCodeAt(0) + extLat);

  return `${char1}${char2}${char3}${char4}${char5}${char6}${char7}${char8}`;
}

/**
 * Converts a Maidenhead Locator string back to center Latitude and Longitude.
 * @param locator Maidenhead string (case insensitive, 2, 4, 6, or 8 characters)
 */
export function maidenheadToLatLon(locator: string): LatLon {
  const clean = locator.trim().toUpperCase();
  if (clean.length < 2) {
    throw new Error('Invalid Maidenhead locator length (must be >= 2 characters)');
  }

  const fieldLon = clean.charCodeAt(0) - 'A'.charCodeAt(0);
  const fieldLat = clean.charCodeAt(1) - 'A'.charCodeAt(0);

  if (fieldLon < 0 || fieldLon > 17 || fieldLat < 0 || fieldLat > 17) {
    throw new Error(`Invalid Maidenhead field: ${clean.substring(0, 2)}`);
  }

  let lon = fieldLon * 20 - 180;
  let lat = fieldLat * 10 - 90;

  // Precision 2 (field center)
  if (clean.length === 2) {
    return {
      latitude: lat + 5,
      longitude: lon + 10,
    };
  }

  const sqLon = clean.charCodeAt(2) - '0'.charCodeAt(0);
  const sqLat = clean.charCodeAt(3) - '0'.charCodeAt(0);
  if (sqLon < 0 || sqLon > 9 || sqLat < 0 || sqLat > 9) {
    throw new Error(`Invalid Maidenhead square: ${clean.substring(2, 4)}`);
  }

  lon += sqLon * 2;
  lat += sqLat * 1;

  // Precision 4 (square center)
  if (clean.length === 4) {
    return {
      latitude: lat + 0.5,
      longitude: lon + 1.0,
    };
  }

  const subLon = clean.charCodeAt(4) - 'A'.charCodeAt(0);
  const subLat = clean.charCodeAt(5) - 'A'.charCodeAt(0);
  if (subLon < 0 || subLon > 23 || subLat < 0 || subLat > 23) {
    throw new Error(`Invalid Maidenhead subsquare: ${clean.substring(4, 6)}`);
  }

  lon += subLon * (2 / 24);
  lat += subLat * (1 / 24);

  // Precision 6 (subsquare center)
  if (clean.length === 6) {
    return {
      latitude: Number((lat + 1 / 48).toFixed(6)),
      longitude: Number((lon + 2 / 48).toFixed(6)),
    };
  }

  const extLon = clean.charCodeAt(6) - '0'.charCodeAt(0);
  const extLat = clean.charCodeAt(7) - '0'.charCodeAt(0);
  if (extLon < 0 || extLon > 9 || extLat < 0 || extLat > 9) {
    throw new Error(`Invalid Maidenhead extended square: ${clean.substring(6, 8)}`);
  }

  lon += extLon * (2 / 240);
  lat += extLat * (1 / 240);

  // Precision 8 (extended center)
  return {
    latitude: Number((lat + 1 / 480).toFixed(6)),
    longitude: Number((lon + 2 / 480).toFixed(6)),
  };
}
