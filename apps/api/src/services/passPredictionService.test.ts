import { describe, expect, it } from 'vitest';
import type { GroundStation } from '@orbitdeck/shared';
import { PassPredictionService } from './passPredictionService.js';
import { PropagationService } from './propagationService.js';
import { DEFAULT_SATELLITES } from './tleFallbackData.js';

describe('PassPredictionService', () => {
  const propService = new PropagationService();
  const passService = new PassPredictionService(propService);
  const iss = DEFAULT_SATELLITES.find((s) => s.noradId === 25544)!;

  const station: GroundStation = {
    id: 'test-greenwich',
    name: 'Royal Observatory Greenwich',
    latitude: 51.4769,
    longitude: 0.0005,
    altitude: 48,
    maidenhead: 'IO91wm',
    isDefault: true,
  };

  it('should predict passes for ISS over station over 3 days', () => {
    const passes = passService.predictPasses(iss, station, {
      daysAhead: 3,
      minElevationDeg: 10,
      stepSeconds: 20,
    });

    expect(passes.length).toBeGreaterThan(0);

    for (const pass of passes) {
      expect(pass.noradId).toBe(25544);
      expect(pass.stationId).toBe(station.id);
      expect(pass.aosTime).toBeLessThan(pass.maxElTime);
      expect(pass.maxElTime).toBeLessThan(pass.losTime);
      expect(pass.maxElevationDeg).toBeGreaterThanOrEqual(10);
      expect(pass.durationSeconds).toBeGreaterThan(60); // passes last several minutes
      expect(pass.durationSeconds).toBeLessThan(1200); // LEO passes never exceed 20 minutes
      expect(['daylight', 'visible', 'eclipsed']).toContain(pass.visibility);
      expect(pass.points?.length).toBeGreaterThan(0);
    }
  });

  it('should export predicted passes to valid iCalendar (.ics) format', () => {
    const passes = passService.predictPasses(iss, station, {
      daysAhead: 1,
      minElevationDeg: 15,
      stepSeconds: 30,
    });

    const ics = passService.exportToIcs(passes);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//OrbitDeck//Satellite Pass Prediction//EN');
    if (passes.length > 0) {
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Pass: ISS (ZARYA)');
      expect(ics).toContain('END:VEVENT');
    }
    expect(ics).toContain('END:VCALENDAR');
  });

  it('should export predicted passes to valid CSV format', () => {
    const passes = passService.predictPasses(iss, station, {
      daysAhead: 1,
      minElevationDeg: 15,
      stepSeconds: 30,
    });

    const csv = passService.exportToCsv(passes);
    expect(csv).toContain('Satellite,NORAD ID,Station,AOS (UTC),LOS (UTC)');
    if (passes.length > 0) {
      expect(csv).toContain('ISS (ZARYA)');
      expect(csv).toContain('25544');
    }
  });
});
