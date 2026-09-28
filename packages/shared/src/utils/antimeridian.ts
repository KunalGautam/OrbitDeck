export interface LatLonPoint {
  latitude: number;
  longitude: number;
}

/**
 * Splits a continuous ground track sequence into segments at antimeridian crossings
 * (|lon2 - lon1| > 180). This prevents 2D maps from drawing lines across the entire world.
 */
export function splitTrackAtAntimeridian<T extends { latitude: number; longitude: number }>(
  points: T[],
): T[][] {
  if (points.length === 0) return [];

  const segments: T[][] = [];
  let currentSegment: T[] = [points[0]!];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;

    const dLon = curr.longitude - prev.longitude;

    if (Math.abs(dLon) > 180) {
      // Crossed antimeridian!
      // Calculate intersection latitude at +-180
      const sign = prev.longitude > 0 ? 1 : -1;
      const targetLon = sign * 180;
      const otherLon = -sign * 180;

      // Linear interpolation factor for latitude
      const span = curr.longitude - (prev.longitude - sign * 360);
      const fraction = (targetLon - prev.longitude) / span;
      const midLat = prev.latitude + (curr.latitude - prev.latitude) * fraction;

      // Close current segment at +-180
      currentSegment.push({
        ...curr,
        latitude: midLat,
        longitude: targetLon,
      });
      segments.push(currentSegment);

      // Start new segment at -+180
      currentSegment = [
        {
          ...prev,
          latitude: midLat,
          longitude: otherLon,
        },
        curr,
      ];
    } else {
      currentSegment.push(curr);
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Generates an array of [lat, lon] coordinates representing a footprint circle on Earth's surface.
 * @param centerLat Center latitude in degrees
 * @param centerLon Center longitude in degrees
 * @param radiusKm Footprint radius along surface in km
 * @param numPoints Number of polygon vertices
 */
export function generateFootprintCircle(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  numPoints: number = 64,
): [number, number][] {
  const earthRadiusKm = 6371.0;
  const angularDist = radiusKm / earthRadiusKm; // angular radius in radians
  const latRad = (centerLat * Math.PI) / 180;
  const lonRad = (centerLon * Math.PI) / 180;

  const coords: [number, number][] = [];

  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i * 2 * Math.PI) / numPoints;

    const ptLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) +
        Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing),
    );

    const ptLonRad =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
        Math.cos(angularDist) - Math.sin(latRad) * Math.sin(ptLatRad),
      );

    let ptLonDeg = (ptLonRad * 180) / Math.PI;
    const ptLatDeg = (ptLatRad * 180) / Math.PI;

    // Normalize lon to [-180, 180]
    while (ptLonDeg > 180) ptLonDeg -= 360;
    while (ptLonDeg < -180) ptLonDeg += 360;

    coords.push([ptLatDeg, ptLonDeg]);
  }

  return coords;
}

/**
 * Splits a footprint polygon if it crosses the antimeridian, returning 1 or 2 closed polygons
 * formatted as [lat, lon][] suitable for 2D map renderers (Leaflet, OpenLayers, MapLibre).
 */
export function splitPolygonAtAntimeridian(ring: [number, number][]): [number, number][][] {
  if (ring.length < 3) return [ring];

  let crosses = false;
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i]![1] - ring[i - 1]![1]) > 180) {
      crosses = true;
      break;
    }
  }

  if (!crosses) {
    return [ring];
  }

  // If it crosses, partition points into Eastern (lon > 0) and Western (lon < 0) halves
  const eastRing: [number, number][] = [];
  const westRing: [number, number][] = [];

  for (const [lat, lon] of ring) {
    if (lon >= 0) {
      eastRing.push([lat, lon]);
    } else {
      westRing.push([lat, lon]);
    }
  }

  const result: [number, number][][] = [];
  if (eastRing.length >= 3) result.push(eastRing);
  if (westRing.length >= 3) result.push(westRing);
  return result.length > 0 ? result : [ring];
}
