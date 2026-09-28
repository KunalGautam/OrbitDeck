import type {
  GroundStation,
  PassPoint,
  PassPrediction,
  PassQueryOptions,
  PassVisibility,
  Satellite,
} from '@orbitdeck/shared';
import * as _SunCalc from 'suncalc';
const SunCalc = (_SunCalc as any).default || _SunCalc;
import { v4 as uuidv4 } from 'uuid';
import type { PropagationService } from './propagationService.js';

export class PassPredictionService {
  constructor(private readonly propService: PropagationService) {}

  /**
   * Predicts all passes for a given satellite and ground station over next N days.
   */
  predictPasses(
    sat: Satellite,
    station: GroundStation,
    options: Partial<PassQueryOptions> = {},
  ): PassPrediction[] {
    const daysAhead = options.daysAhead ?? 3;
    const minEl = options.minElevationDeg ?? 10;
    const stepSec = options.stepSeconds ?? 15;

    const startTime = Date.now();
    const endTime = startTime + daysAhead * 24 * 60 * 60 * 1000;

    const passes: PassPrediction[] = [];
    let inPass = false;
    let currentPassPoints: PassPoint[] = [];
    let aosTime = 0;
    let aosAz = 0;
    let maxEl = -90;
    let maxElTime = 0;

    // Coarse scan loop
    for (let t = startTime; t <= endTime; t += stepSec * 1000) {
      const frame = this.propService.propagate(sat, t, station);
      if (!frame || frame.elevationDeg === undefined || frame.azimuthDeg === undefined) {
        continue;
      }

      const el = frame.elevationDeg;
      const az = frame.azimuthDeg;

      if (el > 0) {
        // Above horizon
        if (!inPass) {
          inPass = true;
          aosTime = t;
          aosAz = az;
          maxEl = el;
          maxElTime = t;
          currentPassPoints = [];
        }

        if (el > maxEl) {
          maxEl = el;
          maxElTime = t;
        }

        currentPassPoints.push({
          timestamp: t,
          azimuthDeg: az,
          elevationDeg: el,
          rangeKm: frame.rangeKm || 0,
          latitude: frame.latitude,
          longitude: frame.longitude,
          altitudeKm: frame.altitudeKm,
          isEclipsed: frame.eclipseStatus !== 'sunlit',
        });
      } else {
        // Below horizon
        if (inPass) {
          inPass = false;
          const losTime = t;
          const losAz = az;

          if (maxEl >= minEl) {
            const visibility = this.determineVisibility(sat, station, maxElTime);

            passes.push({
              id: uuidv4(),
              noradId: sat.noradId,
              satelliteName: sat.name,
              stationId: station.id,
              stationName: station.name,
              aosTime,
              losTime,
              maxElTime,
              maxElevationDeg: Number(maxEl.toFixed(2)),
              aosAzimuthDeg: Number(aosAz.toFixed(2)),
              losAzimuthDeg: Number(losAz.toFixed(2)),
              durationSeconds: Math.round((losTime - aosTime) / 1000),
              visibility,
              points: currentPassPoints,
            });
          }

          currentPassPoints = [];
          maxEl = -90;
        }
      }
    }

    return passes;
  }

  /**
   * Evaluates visibility condition during pass:
   * - 'daylight': Sun is above civil twilight (-6 deg)
   * - 'visible': Sun is below -6 deg and satellite is illuminated by Sun
   * - 'eclipsed': Satellite is in Earth's shadow
   */
  private determineVisibility(
    sat: Satellite,
    station: GroundStation,
    timestamp: number,
  ): PassVisibility {
    const date = new Date(timestamp);
    const sunPos = SunCalc.getPosition(date, station.latitude, station.longitude);
    const sunAltitudeDeg = (sunPos.altitude * 180) / Math.PI;

    if (sunAltitudeDeg > -6) {
      return 'daylight';
    }

    const frame = this.propService.propagate(sat, timestamp);
    if (frame && frame.eclipseStatus === 'sunlit') {
      return 'visible';
    }

    return 'eclipsed';
  }

  /**
   * Exports passes to iCalendar (.ics) RFC 5545 format.
   */
  exportToIcs(passes: PassPrediction[]): string {
    const formatDate = (epochMs: number): string => {
      const d = new Date(epochMs);
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//OrbitDeck//Satellite Pass Prediction//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const pass of passes) {
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${pass.id}@orbitdeck.local`);
      lines.push(`DTSTAMP:${formatDate(Date.now())}`);
      lines.push(`DTSTART:${formatDate(pass.aosTime)}`);
      lines.push(`DTEND:${formatDate(pass.losTime)}`);
      lines.push(
        `SUMMARY:Pass: ${pass.satelliteName} (Max ${pass.maxElevationDeg}° ${pass.visibility})`,
      );
      lines.push(
        `DESCRIPTION:Satellite: ${pass.satelliteName}\\n` +
          `Station: ${pass.stationName}\\n` +
          `AOS: ${new Date(pass.aosTime).toUTCString()} (Az: ${pass.aosAzimuthDeg}°)\\n` +
          `Max El: ${pass.maxElevationDeg}° at ${new Date(pass.maxElTime).toUTCString()}\\n` +
          `LOS: ${new Date(pass.losTime).toUTCString()} (Az: ${pass.losAzimuthDeg}°)\\n` +
          `Duration: ${Math.floor(pass.durationSeconds / 60)}m ${pass.durationSeconds % 60}s\\n` +
          `Visibility: ${pass.visibility}`,
      );
      lines.push(`LOCATION:${pass.stationName}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /**
   * Exports passes to standard CSV format.
   */
  exportToCsv(passes: PassPrediction[]): string {
    const headers = [
      'Satellite',
      'NORAD ID',
      'Station',
      'AOS (UTC)',
      'LOS (UTC)',
      'Max El Time (UTC)',
      'Max Elevation (deg)',
      'Duration (sec)',
      'AOS Azimuth (deg)',
      'LOS Azimuth (deg)',
      'Visibility',
    ];

    const rows = passes.map((p) => [
      `"${p.satelliteName.replace(/"/g, '""')}"`,
      p.noradId,
      `"${p.stationName.replace(/"/g, '""')}"`,
      `"${new Date(p.aosTime).toISOString()}"`,
      `"${new Date(p.losTime).toISOString()}"`,
      `"${new Date(p.maxElTime).toISOString()}"`,
      p.maxElevationDeg,
      p.durationSeconds,
      p.aosAzimuthDeg,
      p.losAzimuthDeg,
      p.visibility,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}
