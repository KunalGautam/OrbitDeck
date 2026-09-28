import { describe, expect, it } from 'vitest';
import type { GroundStation } from '@orbitdeck/shared';
import { PropagationService } from './propagationService.js';
import { DEFAULT_SATELLITES } from './tleFallbackData.js';

describe('PropagationService', () => {
  const propService = new PropagationService();
  const iss = DEFAULT_SATELLITES.find((s) => s.noradId === 25544)!;

  const greenwichStation: GroundStation = {
    id: 'test-greenwich',
    name: 'Greenwich',
    latitude: 51.4769,
    longitude: 0.0005,
    altitude: 48,
    maidenhead: 'IO91wm',
    isDefault: true,
  };

  it('should propagate ISS to a valid geodetic position', () => {
    const now = new Date('2024-03-20T12:00:00Z');
    const frame = propService.propagate(iss, now, greenwichStation);

    expect(frame).not.toBeNull();
    expect(frame?.noradId).toBe(25544);
    expect(frame?.latitude).toBeGreaterThanOrEqual(-90);
    expect(frame?.latitude).toBeLessThanOrEqual(90);
    expect(frame?.longitude).toBeGreaterThanOrEqual(-180);
    expect(frame?.longitude).toBeLessThanOrEqual(180);
    expect(frame?.altitudeKm).toBeGreaterThan(350);
    expect(frame?.altitudeKm).toBeLessThan(450);
    expect(frame?.velocityKmS).toBeGreaterThan(7.0);
    expect(frame?.velocityKmS).toBeLessThan(8.0);
    expect(frame?.footprintRadiusKm).toBeGreaterThan(2000);
    expect(['sunlit', 'umbra', 'penumbra']).toContain(frame?.eclipseStatus);

    // Look angles relative to station
    expect(frame?.azimuthDeg).toBeDefined();
    expect(frame?.azimuthDeg).toBeGreaterThanOrEqual(0);
    expect(frame?.azimuthDeg).toBeLessThanOrEqual(360);
    expect(frame?.elevationDeg).toBeDefined();
    expect(frame?.rangeKm).toBeGreaterThan(0);
    expect(frame?.rangeRateKmS).toBeDefined();
  });

  it('should generate continuous ground track points', () => {
    const center = new Date('2024-03-20T12:00:00Z');
    const points = propService.generateGroundTrack(iss, center, 0.2, 0.2, 60);

    expect(points.length).toBeGreaterThan(10);
    for (const pt of points) {
      expect(pt.latitude).toBeGreaterThanOrEqual(-90);
      expect(pt.latitude).toBeLessThanOrEqual(90);
      expect(pt.longitude).toBeGreaterThanOrEqual(-180);
      expect(pt.longitude).toBeLessThanOrEqual(180);
    }
  });

  it('should return Sun and Moon celestial positions', () => {
    const date = new Date('2024-03-20T12:00:00Z');
    const celestial = propService.getCelestialPositions(date, greenwichStation);

    expect(celestial.length).toBe(2);
    const sun = celestial.find((c) => c.type === 'sun');
    const moon = celestial.find((c) => c.type === 'moon');

    expect(sun).toBeDefined();
    expect(sun?.azimuthDeg).toBeDefined();
    expect(sun?.elevationDeg).toBeDefined();

    expect(moon).toBeDefined();
    expect(moon?.azimuthDeg).toBeDefined();
  });
});
