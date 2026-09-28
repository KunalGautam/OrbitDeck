import type { Satellite, SatelliteGroup } from '@orbitdeck/shared';
import cron, { type ScheduledTask } from 'node-cron';
import type { ISatelliteRepository } from '../db/repositories/satelliteRepository.js';
import type { ISettingsRepository } from '../db/repositories/settingsRepository.js';
import { DEFAULT_SATELLITES } from './tleFallbackData.js';

export interface TLESourceConfig {
  group: SatelliteGroup;
  url: string;
}

export const CELESTRAK_SOURCES: TLESourceConfig[] = [
  {
    group: 'stations',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle',
  },
  { group: 'amateur', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle' },
  { group: 'weather', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle' },
  { group: 'gnss', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=tle' },
  { group: 'cubesat', url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cubesat&FORMAT=tle' },
];

export class TLEService {
  private cronJob: ScheduledTask | null = null;
  private lastRefreshTime: string | null = null;
  private isRefreshing: boolean = false;

  constructor(
    private readonly satRepo: ISatelliteRepository,
    private readonly settingsRepo: ISettingsRepository,
  ) {}

  /**
   * Initializes satellite data by seeding default satellites if none exist,
   * then starting the background cron refresh job.
   */
  async initialize(): Promise<void> {
    const count = await this.satRepo.count();
    if (count === 0) {
      console.log('Seeding initial satellite catalogue from fallback cache...');
      await this.satRepo.upsertMany(DEFAULT_SATELLITES);
    }

    const lastTime = await this.settingsRepo.get<string>('tle.last_refresh_time');
    if (lastTime) {
      this.lastRefreshTime = lastTime;
    }

    this.startScheduledRefresh();
  }

  /**
   * Parses standard 3-line or 2-line TLE text into Satellite models.
   */
  parseTLE(rawText: string, group: SatelliteGroup): Satellite[] {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const satellites: Satellite[] = [];
    const now = new Date().toISOString();

    let i = 0;
    while (i < lines.length) {
      const lineA = lines[i]!;
      const lineB = lines[i + 1];
      const lineC = lines[i + 2];

      // Format 1: 3-line TLE (Name, Line 1, Line 2)
      if (lineB && lineC && lineB.startsWith('1 ') && lineC.startsWith('2 ')) {
        const name = lineA;
        const line1 = lineB;
        const line2 = lineC;
        const sat = this.createSatelliteFromLines(name, line1, line2, group, now);
        if (sat) satellites.push(sat);
        i += 3;
        continue;
      }

      // Format 2: 2-line TLE without name header
      if (lineA.startsWith('1 ') && lineB && lineB.startsWith('2 ')) {
        const noradId = parseInt(lineA.substring(2, 7).trim(), 10);
        const name = `SAT-${noradId}`;
        const sat = this.createSatelliteFromLines(name, lineA, lineB, group, now);
        if (sat) satellites.push(sat);
        i += 2;
        continue;
      }

      i++;
    }

    return satellites;
  }

  private createSatelliteFromLines(
    name: string,
    line1: string,
    line2: string,
    group: SatelliteGroup,
    updatedAt: string,
  ): Satellite | null {
    try {
      const noradId = parseInt(line1.substring(2, 7).trim(), 10);
      if (isNaN(noradId)) return null;

      const intlDes = line1.substring(9, 17).trim();
      const epochYearStr = line1.substring(18, 20).trim();
      const epochDayStr = line1.substring(20, 32).trim();
      const incDegStr = line2.substring(8, 16).trim();
      const meanMotionStr = line2.substring(52, 63).trim(); // revolutions per day

      let epochYear = parseInt(epochYearStr, 10);
      if (!isNaN(epochYear)) {
        epochYear = epochYear < 57 ? 2000 + epochYear : 1900 + epochYear;
      }
      const epochDay = parseFloat(epochDayStr);
      const inclinationDeg = parseFloat(incDegStr);
      const meanMotion = parseFloat(meanMotionStr);
      const periodMinutes = meanMotion > 0 ? (24 * 60) / meanMotion : undefined;

      return {
        noradId,
        name: name.replace(/^0\s+/, '').trim(),
        line1,
        line2,
        groups: [group],
        updatedAt,
        intlDes: intlDes || undefined,
        epochYear: isNaN(epochYear) ? undefined : epochYear,
        epochDay: isNaN(epochDay) ? undefined : epochDay,
        inclinationDeg: isNaN(inclinationDeg) ? undefined : inclinationDeg,
        periodMinutes,
      };
    } catch {
      return null;
    }
  }

  /**
   * Checks whether a satellite's TLE is stale (> 14 days old).
   */
  isStale(satellite: Satellite, maxAgeDays: number = 14): boolean {
    if (!satellite.epochYear || !satellite.epochDay) return true;

    // Convert epoch year and day to UTC Date
    const epochDate = new Date(Date.UTC(satellite.epochYear, 0, 1));
    epochDate.setUTCDate(epochDate.getUTCDate() + (satellite.epochDay - 1));

    const ageMs = Date.now() - epochDate.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    return ageDays > maxAgeDays;
  }

  /**
   * Refreshes TLE data from CelesTrak (with fallback to default catalogue if offline).
   */
  async refreshAll(): Promise<{ updated: number; failedGroups: string[] }> {
    if (this.isRefreshing) {
      throw new Error('Refresh is already in progress');
    }

    this.isRefreshing = true;
    const failedGroups: string[] = [];
    const aggregatedSats = new Map<number, Satellite>();

    try {
      for (const source of CELESTRAK_SOURCES) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          const response = await fetch(source.url, {
            headers: { 'User-Agent': 'OrbitDeck/1.0 (Satellite Tracking; Gpredict inspired)' },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            failedGroups.push(source.group);
            continue;
          }

          const text = await response.text();
          const parsed = this.parseTLE(text, source.group);

          for (const sat of parsed) {
            const existing = aggregatedSats.get(sat.noradId);
            if (existing) {
              if (!existing.groups.includes(source.group)) {
                existing.groups.push(source.group);
              }
            } else {
              aggregatedSats.set(sat.noradId, sat);
            }
          }
        } catch {
          failedGroups.push(source.group);
        }
      }

      // If all network sources failed, ensure we keep the fallback catalogue
      if (aggregatedSats.size === 0) {
        console.warn('Network refresh returned 0 satellites. Using fallback catalogue.');
        for (const def of DEFAULT_SATELLITES) {
          aggregatedSats.set(def.noradId, def);
        }
      }

      const allList = Array.from(aggregatedSats.values());
      await this.satRepo.upsertMany(allList);

      const now = new Date().toISOString();
      this.lastRefreshTime = now;
      await this.settingsRepo.set('tle.last_refresh_time', now);

      return {
        updated: allList.length,
        failedGroups,
      };
    } finally {
      this.isRefreshing = false;
    }
  }

  startScheduledRefresh(): void {
    if (this.cronJob) {
      this.cronJob.stop();
    }

    // Daily at 03:00 UTC
    this.cronJob = cron.schedule('0 3 * * *', async () => {
      try {
        console.log('[TLE Cron] Starting scheduled TLE refresh...');
        const res = await this.refreshAll();
        console.log(`[TLE Cron] Refresh completed: ${res.updated} updated.`);
      } catch (err) {
        console.error('[TLE Cron] Refresh failed:', err);
      }
    });
  }

  stopScheduledRefresh(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  getLastRefreshTime(): string | null {
    return this.lastRefreshTime;
  }
}
