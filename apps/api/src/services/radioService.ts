import { type Transponder, calculateDopplerShift } from '@orbitdeck/shared';

export interface LiveTransponderState extends Transponder {
  uplinkShiftHz?: number;
  uplinkCorrectedHz?: number;
  downlinkShiftHz?: number;
  downlinkCorrectedHz?: number;
}

export const FALLBACK_TRANSPONDERS: Record<number, Transponder[]> = {
  // ISS (25544)
  25544: [
    {
      id: 'iss-fm-voice',
      noradId: 25544,
      description: 'FM Voice Repeater (V/U)',
      uplinkLowHz: 145990000,
      downlinkLowHz: 437800000,
      mode: 'FM',
      alive: true,
    },
    {
      id: 'iss-aprs',
      noradId: 25544,
      description: 'Packet Radio / APRS',
      uplinkLowHz: 145825000,
      downlinkLowHz: 145825000,
      mode: 'AFSK 1200',
      alive: true,
    },
    {
      id: 'iss-downlink-voice',
      noradId: 25544,
      description: 'ARISS School Contacts / Downlink',
      downlinkLowHz: 145800000,
      mode: 'FM',
      alive: true,
    },
  ],
  // SO-50 (27607)
  27607: [
    {
      id: 'so50-fm',
      noradId: 27607,
      description: 'FM Voice Repeater (67.0 Hz PL)',
      uplinkLowHz: 145850000,
      downlinkLowHz: 436795000,
      mode: 'FM',
      alive: true,
    },
  ],
  // AO-91 (43017)
  43017: [
    {
      id: 'ao91-fm',
      noradId: 43017,
      description: 'FM Voice Repeater (U/V, 67.0 Hz PL)',
      uplinkLowHz: 435250000,
      downlinkLowHz: 145960000,
      mode: 'FM',
      alive: true,
    },
  ],
  // NOAA 15 (25338)
  25338: [
    {
      id: 'noaa15-apt',
      noradId: 25338,
      description: 'APT Weather Fax',
      downlinkLowHz: 137620000,
      mode: 'FM/APT',
      alive: true,
    },
  ],
  // NOAA 18 (28654)
  28654: [
    {
      id: 'noaa18-apt',
      noradId: 28654,
      description: 'APT Weather Fax',
      downlinkLowHz: 137912500,
      mode: 'FM/APT',
      alive: true,
    },
  ],
  // NOAA 19 (33591)
  33591: [
    {
      id: 'noaa19-apt',
      noradId: 33591,
      description: 'APT Weather Fax',
      downlinkLowHz: 137100000,
      mode: 'FM/APT',
      alive: true,
    },
  ],
};

export class RadioService {
  private readonly transponderCache = new Map<number, Transponder[]>();

  /**
   * Retrieves transponders for a given NORAD satellite ID from SatNOGS DB API,
   * falling back to local database if unavailable or offline.
   */
  async getTransponders(noradId: number): Promise<Transponder[]> {
    if (this.transponderCache.has(noradId)) {
      return this.transponderCache.get(noradId)!;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://db.satnogs.org/api/transponders/?satellite__norad_cat_id=${noradId}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'OrbitDeck/1.0 (Satellite Tracking)',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as any[];
        if (Array.isArray(data) && data.length > 0) {
          const transponders: Transponder[] = data.map((item) => ({
            id: String(item.uuid || item.id),
            noradId,
            description: item.description || item.mode || 'Transponder',
            uplinkLowHz: item.uplink_low ? Number(item.uplink_low) : undefined,
            uplinkHighHz: item.uplink_high ? Number(item.uplink_high) : undefined,
            downlinkLowHz: item.downlink_low ? Number(item.downlink_low) : undefined,
            downlinkHighHz: item.downlink_high ? Number(item.downlink_high) : undefined,
            mode: item.mode || undefined,
            baud: item.baud ? Number(item.baud) : undefined,
            invert: Boolean(item.invert),
            alive: Boolean(item.alive),
          }));

          this.transponderCache.set(noradId, transponders);
          return transponders;
        }
      }
    } catch {
      // SatNOGS network error or timeout, proceed to fallback
    }

    // Use fallback catalogue
    const fallback = FALLBACK_TRANSPONDERS[noradId] || [];
    this.transponderCache.set(noradId, fallback);
    return fallback;
  }

  /**
   * Calculates live Doppler-corrected frequencies given the line-of-sight range rate (km/s).
   * For Downlink: ground station receives Doppler-shifted signal.
   * For Uplink: ground station must pre-compensate transmit frequency so satellite receives nominal.
   */
  calculateDopplerState(transponder: Transponder, rangeRateKmS: number): LiveTransponderState {
    const result: LiveTransponderState = { ...transponder };

    if (transponder.downlinkLowHz) {
      const { shiftHz, receivedFreqHz } = calculateDopplerShift(
        transponder.downlinkLowHz,
        rangeRateKmS,
      );
      result.downlinkShiftHz = shiftHz;
      result.downlinkCorrectedHz = receivedFreqHz;
    }

    if (transponder.uplinkLowHz) {
      // To counteract Doppler shift at the satellite, transmitter transmits at opposite shift:
      const { shiftHz } = calculateDopplerShift(transponder.uplinkLowHz, rangeRateKmS);
      result.uplinkShiftHz = -shiftHz;
      result.uplinkCorrectedHz = transponder.uplinkLowHz - shiftHz;
    }

    return result;
  }
}
