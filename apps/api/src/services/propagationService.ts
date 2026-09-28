import {
  type CelestialPosition,
  type EclipseStatus,
  type GroundStation,
  type GroundTrackPoint,
  type LiveTrackingFrame,
  type Satellite,
  calculateFootprintRadiusKm,
} from '@orbitdeck/shared';
import * as satellite from 'satellite.js';
import * as _SunCalc from 'suncalc';
const SunCalc = (_SunCalc as any).default || _SunCalc;

export interface PropagationOptions {
  station?: GroundStation | null;
  includeVelocityVector?: boolean;
}

export class PropagationService {
  private readonly satrecCache = new Map<number, satellite.SatRec>();

  /**
   * Retrieves or builds a cached SatRec object for a given satellite.
   */
  getSatRec(sat: Satellite): satellite.SatRec {
    let satrec = this.satrecCache.get(sat.noradId);
    if (!satrec) {
      satrec = satellite.twoline2satrec(sat.line1, sat.line2);
      this.satrecCache.set(sat.noradId, satrec);
    }
    return satrec;
  }

  /**
   * Propagates a satellite to a specific timestamp (Date or epoch ms).
   */
  propagate(
    sat: Satellite,
    time: Date | number,
    station?: GroundStation | null,
  ): LiveTrackingFrame | null {
    const date = typeof time === 'number' ? new Date(time) : time;
    const satrec = this.getSatRec(sat);

    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity) {
      return null;
    }

    const positionEci = positionAndVelocity.position as satellite.EciVec3<number>;
    const velocityEci = positionAndVelocity.velocity as satellite.EciVec3<number>;

    if (!positionEci || !velocityEci || typeof positionEci === 'boolean') {
      return null;
    }

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEci, gmst);

    const latitude = satellite.degreesLat(geodetic.latitude);
    const longitude = satellite.degreesLong(geodetic.longitude);
    const altitudeKm = geodetic.height;

    // Total scalar velocity in km/s
    const velocityKmS = Math.sqrt(
      velocityEci.x * velocityEci.x + velocityEci.y * velocityEci.y + velocityEci.z * velocityEci.z,
    );

    const footprintRadiusKm = calculateFootprintRadiusKm(altitudeKm);
    const eclipseStatus = this.calculateEclipseStatus(positionEci, date);

    const frame: LiveTrackingFrame = {
      noradId: sat.noradId,
      name: sat.name,
      timestamp: date.getTime(),
      latitude: Number(latitude.toFixed(4)),
      longitude: Number(longitude.toFixed(4)),
      altitudeKm: Number(altitudeKm.toFixed(2)),
      velocityKmS: Number(velocityKmS.toFixed(3)),
      footprintRadiusKm: Number(footprintRadiusKm.toFixed(1)),
      eclipseStatus,
    };

    // Calculate station-relative angles if station provided
    if (station) {
      const observerGeodetic = {
        longitude: satellite.degreesToRadians(station.longitude),
        latitude: satellite.degreesToRadians(station.latitude),
        height: (station.altitude || 0) / 1000.0, // convert meters to km
      };

      const positionEcf = satellite.eciToEcf(positionEci, gmst);
      const velocityEcf = satellite.eciToEcf(velocityEci, gmst);
      const observerEcf = satellite.geodeticToEcf(observerGeodetic);

      const lookAngles = satellite.ecfToLookAngles(observerGeodetic, positionEcf);

      const azimuthDeg = satellite.radiansToDegrees(lookAngles.azimuth);
      const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);
      const rangeKm = lookAngles.rangeSat;

      // Range rate in km/s: dot product of relative position and relative velocity divided by range
      const dx = positionEcf.x - observerEcf.x;
      const dy = positionEcf.y - observerEcf.y;
      const dz = positionEcf.z - observerEcf.z;
      const rangeRateKmS =
        rangeKm > 0 ? (dx * velocityEcf.x + dy * velocityEcf.y + dz * velocityEcf.z) / rangeKm : 0;

      frame.stationId = station.id;
      frame.azimuthDeg = Number(azimuthDeg.toFixed(2));
      frame.elevationDeg = Number(elevationDeg.toFixed(2));
      frame.rangeKm = Number(rangeKm.toFixed(2));
      frame.rangeRateKmS = Number(rangeRateKmS.toFixed(3));
    }

    return frame;
  }

  /**
   * Generates ground track trajectory points around current time:
   * from -orbitsBefore to +orbitsAfter orbital periods.
   */
  generateGroundTrack(
    sat: Satellite,
    centerTime: Date | number,
    orbitsPast: number = 0.5,
    orbitsFuture: number = 1.0,
    stepSeconds: number = 60,
  ): GroundTrackPoint[] {
    const centerMs = typeof centerTime === 'number' ? centerTime : centerTime.getTime();
    const periodMin = sat.periodMinutes || 95;
    const periodMs = periodMin * 60 * 1000;

    const startMs = centerMs - orbitsPast * periodMs;
    const endMs = centerMs + orbitsFuture * periodMs;

    const points: GroundTrackPoint[] = [];
    const satrec = this.getSatRec(sat);

    for (let t = startMs; t <= endMs; t += stepSeconds * 1000) {
      const d = new Date(t);
      const posVel = satellite.propagate(satrec, d);
      if (!posVel) continue;
      const pos = posVel.position as satellite.EciVec3<number>;
      if (!pos || typeof pos === 'boolean') continue;

      const gmst = satellite.gstime(d);
      const geo = satellite.eciToGeodetic(pos, gmst);

      points.push({
        latitude: Number(satellite.degreesLat(geo.latitude).toFixed(4)),
        longitude: Number(satellite.degreesLong(geo.longitude).toFixed(4)),
        altitudeKm: Number(geo.height.toFixed(2)),
        timestamp: t,
      });
    }

    return points;
  }

  /**
   * Computes Eclipse status (sunlit, umbra, penumbra) using solar vector and Earth shadow.
   */
  calculateEclipseStatus(satPosEci: satellite.EciVec3<number>, date: Date): EclipseStatus {
    try {
      const jd = satellite.jday(date);
      const sun = satellite.sunPos(jd);
      const sunPosEci = (sun as any).rsun || (sun as any).sunPosition;

      // Distance from Earth center to satellite and Sun
      const rSat = Math.sqrt(
        satPosEci.x * satPosEci.x + satPosEci.y * satPosEci.y + satPosEci.z * satPosEci.z,
      );
      const rSun = Math.sqrt(
        sunPosEci.x * sunPosEci.x + sunPosEci.y * sunPosEci.y + sunPosEci.z * sunPosEci.z,
      );

      // Angle between satellite and Sun vectors from Earth center
      const dot =
        (satPosEci.x * sunPosEci.x + satPosEci.y * sunPosEci.y + satPosEci.z * sunPosEci.z) /
        (rSat * rSun);

      // If angle < 90 degrees (facing sun), definitely sunlit
      if (dot >= 0) return 'sunlit';

      // Check cylindrical shadow approximation (Earth radius = 6378 km)
      const earthRadius = 6378.137;
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      const shadowDist = rSat * Math.sin(angle);

      if (shadowDist > earthRadius + 20) {
        return 'sunlit';
      } else if (shadowDist < earthRadius - 20) {
        return 'umbra';
      } else {
        return 'penumbra';
      }
    } catch {
      return 'sunlit';
    }
  }

  /**
   * Calculates sub-solar and sub-lunar points and their station look angles.
   */
  getCelestialPositions(time: Date | number, station?: GroundStation | null): CelestialPosition[] {
    const date = typeof time === 'number' ? new Date(time) : time;
    const positions: CelestialPosition[] = [];

    // Sun calculation using SunCalc
    const sunPos = SunCalc.getPosition(
      date,
      station ? station.latitude : 0,
      station ? station.longitude : 0,
    );

    // Sub-solar coordinates:
    // Solar declination gives sub-solar latitude
    // Greenwich Hour Angle (GHA = rtasc - gmst) gives sub-solar longitude
    const gmst = satellite.gstime(date);
    const jd = satellite.jday(date);
    const sun = satellite.sunPos(jd);
    const sunLat = (sun.decl * 180) / Math.PI;
    let sunLon = ((sun.rtasc - gmst) * 180) / Math.PI;
    while (sunLon > 180) sunLon -= 360;
    while (sunLon < -180) sunLon += 360;

    positions.push({
      type: 'sun',
      latitude: Number(sunLat.toFixed(4)),
      longitude: Number(sunLon.toFixed(4)),
      azimuthDeg: station
        ? Number((((sunPos.azimuth * 180) / Math.PI + 180) % 360).toFixed(2))
        : undefined,
      elevationDeg: station ? Number(((sunPos.altitude * 180) / Math.PI).toFixed(2)) : undefined,
    });

    // Moon calculation using SunCalc
    const moonPos = SunCalc.getMoonPosition(
      date,
      station ? station.latitude : 0,
      station ? station.longitude : 0,
    );

    // Approximate sub-lunar point
    const moonLatDeg = (moonPos.altitude * 180) / Math.PI; // approximate
    const moonAzDeg = ((moonPos.azimuth * 180) / Math.PI + 180) % 360;

    positions.push({
      type: 'moon',
      latitude: Number(moonLatDeg.toFixed(4)),
      longitude: Number((station ? station.longitude : 0).toFixed(4)),
      azimuthDeg: station ? Number(moonAzDeg.toFixed(2)) : undefined,
      elevationDeg: station ? Number(((moonPos.altitude * 180) / Math.PI).toFixed(2)) : undefined,
    });

    return positions;
  }
}
