import { describe, expect, it } from 'vitest';
import {
  calculateBearingDeg,
  calculateDopplerShift,
  calculateFootprintRadiusKm,
  haversineDistanceKm,
} from './math.js';

describe('Math utilities', () => {
  it('should calculate footprint radius correctly for ISS altitude (~420 km)', () => {
    const radius = calculateFootprintRadiusKm(420);
    // Footprint of ISS (~420 km) is roughly 2200-2400 km
    expect(radius).toBeGreaterThan(2000);
    expect(radius).toBeLessThan(2500);
  });

  it('should calculate Doppler shift correctly (approaching satellite increases frequency)', () => {
    // 145.8 MHz (2m amateur band), approaching at 5 km/s (-5 km/s range rate)
    const result = calculateDopplerShift(145800000, -5.0);
    expect(result.shiftHz).toBeGreaterThan(0);
    expect(result.receivedFreqHz).toBeGreaterThan(145800000);
    // Shift is approx +2.43 kHz
    expect(Math.round(result.shiftHz)).toBe(2432);
  });

  it('should calculate Doppler shift correctly (receding satellite decreases frequency)', () => {
    const result = calculateDopplerShift(145800000, 5.0);
    expect(result.shiftHz).toBeLessThan(0);
    expect(result.receivedFreqHz).toBeLessThan(145800000);
    expect(Math.round(result.shiftHz)).toBe(-2432);
  });

  it('should calculate Haversine distance and bearing', () => {
    // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ~ 340 km
    const dist = haversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(350);

    const bearing = calculateBearingDeg(51.5074, -0.1278, 48.8566, 2.3522);
    expect(bearing).toBeGreaterThan(140);
    expect(bearing).toBeLessThan(160);
  });
});
