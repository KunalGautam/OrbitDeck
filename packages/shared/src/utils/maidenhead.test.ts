import { describe, expect, it } from 'vitest';
import { latLonToMaidenhead, maidenheadToLatLon } from './maidenhead.js';

describe('Maidenhead Grid Locator', () => {
  it('should convert lat/lon to 6-char maidenhead correctly for Munich (JN58sd)', () => {
    // Munich center approx 48.137, 11.575
    const locator = latLonToMaidenhead(48.137, 11.575, 6);
    expect(locator.toUpperCase()).toBe('JN58SD');
  });

  it('should convert lat/lon to 6-char maidenhead for New York / Hartford (FN31pr)', () => {
    const locator = latLonToMaidenhead(41.729, -72.687, 6);
    expect(locator.toUpperCase()).toBe('FN31PR');
  });

  it('should round-trip Maidenhead -> LatLon -> Maidenhead accurately', () => {
    const testCases = ['FN31pr', 'JN58td', 'IO91wm', 'QF22mb', 'AA00aa', 'RR99xx'];
    for (const testCase of testCases) {
      const coords = maidenheadToLatLon(testCase);
      const reconstructed = latLonToMaidenhead(coords.latitude, coords.longitude, 6);
      expect(reconstructed.toLowerCase()).toBe(testCase.toLowerCase());
    }
  });

  it('should handle 4-char precision', () => {
    const locator4 = latLonToMaidenhead(48.137, 11.575, 4);
    expect(locator4.toUpperCase()).toBe('JN58');
  });
});
