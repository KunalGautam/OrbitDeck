import { describe, expect, it } from 'vitest';
import {
  generateFootprintCircle,
  splitPolygonAtAntimeridian,
  splitTrackAtAntimeridian,
} from './antimeridian.js';

describe('Antimeridian utilities', () => {
  it('should split track when crossing 180 deg meridian', () => {
    const points = [
      { latitude: 10, longitude: 175 },
      { latitude: 12, longitude: 179 },
      { latitude: 14, longitude: -178 }, // crossed 180
      { latitude: 16, longitude: -174 },
    ];

    const segments = splitTrackAtAntimeridian(points);
    expect(segments.length).toBe(2);
    // First segment ends at +180
    expect(segments[0]![segments[0]!.length - 1]!.longitude).toBe(180);
    // Second segment starts at -180
    expect(segments[1]![0]!.longitude).toBe(-180);
  });

  it('should keep track intact when not crossing antimeridian', () => {
    const points = [
      { latitude: 10, longitude: 10 },
      { latitude: 12, longitude: 15 },
      { latitude: 14, longitude: 20 },
    ];

    const segments = splitTrackAtAntimeridian(points);
    expect(segments.length).toBe(1);
    expect(segments[0]!.length).toBe(3);
  });

  it('should generate footprint circle points and split if crossing antimeridian', () => {
    const ring = generateFootprintCircle(0, 179, 1000, 32);
    expect(ring.length).toBe(33);

    const splitRings = splitPolygonAtAntimeridian(ring);
    expect(splitRings.length).toBe(2);
  });
});
