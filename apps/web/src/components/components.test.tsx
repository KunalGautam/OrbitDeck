import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from './Header.js';
import { MapSettingsModal } from './MapSettingsModal.js';
import { PassPredictionPanel } from './PassPredictionPanel.js';
import { RadioPanel } from './RadioPanel.js';
import { SatelliteDetailPanel } from './SatelliteDetailPanel.js';
import { SatelliteTable } from './SatelliteTable.js';
import { StationModal } from './StationModal.js';
import { OrbitDeckProvider } from '../context/OrbitDeckContext.js';

// Mock fetch globally for client calls
beforeEach(() => {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/stations')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          stations: [
            {
              id: 'st-1',
              name: 'Test QTH',
              latitude: 51.5074,
              longitude: -0.1278,
              altitude: 45,
              maidenhead: 'IO91wm',
              isDefault: true,
            },
          ],
        }),
      });
    }

    if (url.includes('/api/satellites')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          satellites: [
            {
              noradId: 25544,
              name: 'ISS (ZARYA)',
              line1: '1 25544U 98067A   24080.50000000  .00016717  00000-0  10270-3 0  9001',
              line2: '2 25544  51.6400 208.1000 0004500 120.5000 240.2000 15.49815000450001',
              groups: ['stations', 'amateur'],
              updatedAt: new Date().toISOString(),
              isStale: false,
              isFavorite: true,
            },
          ],
          total: 1,
        }),
      });
    }

    if (url.includes('/api/passes')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          noradId: 25544,
          satelliteName: 'ISS (ZARYA)',
          stationId: 'st-1',
          stationName: 'Test QTH',
          daysAhead: 3,
          minElevationDeg: 10,
          totalPasses: 1,
          passes: [
            {
              id: 'pass-1',
              noradId: 25544,
              satelliteName: 'ISS (ZARYA)',
              stationId: 'st-1',
              stationName: 'Test QTH',
              aosTime: Date.now() + 3600000,
              losTime: Date.now() + 4200000,
              maxElTime: Date.now() + 3900000,
              maxElevationDeg: 45.2,
              aosAzimuthDeg: 210,
              losAzimuthDeg: 60,
              durationSeconds: 600,
              visibility: 'visible',
            },
          ],
        }),
      });
    }

    if (url.includes('/api/radio')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          noradId: 25544,
          satelliteName: 'ISS (ZARYA)',
          rangeRateKmS: -2.5,
          transponders: [
            {
              id: 'tp-1',
              noradId: 25544,
              description: 'V/U FM Voice Repeater',
              uplinkLowHz: 145990000,
              downlinkLowHz: 437800000,
              mode: 'FM',
              alive: true,
            },
          ],
        }),
      });
    }

    if (url.includes('/api/hamlib/status')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          config: {
            enabled: true,
            rigHost: 'localhost',
            rigPort: 4532,
            rotHost: 'localhost',
            rotPort: 4533,
            updateIntervalMs: 1000,
          },
          status: { connectedRig: true, connectedRot: true },
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  }) as any;
});

describe('OrbitDeck Web Component Suite', () => {
  it('renders Header with brand and controls', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <Header onOpenStationModal={() => {}} onOpenMapSettings={() => {}} />
        </OrbitDeckProvider>,
      );
    });

    expect(container.textContent).toContain('ORBITDECK');
    expect(container.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('Polar Plot');
    expect(container.textContent).toContain('Telemetry');
    expect(container.textContent).toContain('Passes');
    expect(container.textContent).toContain('Radio');

    root.unmount();
    container.remove();
  });

  it('renders SatelliteDetailPanel with telemetry information', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <SatelliteDetailPanel />
        </OrbitDeckProvider>,
      );
    });

    expect(container.textContent).toContain('Sub-Satellite Coordinates');
    expect(container.textContent).toContain('Relative to QTH');
    expect(container.textContent).toContain('Two-Line Element Set');

    root.unmount();
    container.remove();
  });

  it('renders SatelliteTable with filtering and search', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <SatelliteTable />
        </OrbitDeckProvider>,
      );
    });

    expect(container.querySelector('input[placeholder*="Search"]')).not.toBeNull();
    expect(container.textContent).toContain('Space Stations');
    expect(container.textContent).toContain('Amateur Radio');

    root.unmount();
    container.remove();
  });

  it('renders PassPredictionPanel with pass calculations', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <PassPredictionPanel />
        </OrbitDeckProvider>,
      );
    });

    expect(container.textContent).toContain('Pass Predictions');
    expect(container.textContent).toContain('Min Elevation');
    expect(container.textContent).toContain('.ICS');
    expect(container.textContent).toContain('CSV');

    root.unmount();
    container.remove();
  });

  it('renders RadioPanel with Doppler and Hamlib controls', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <RadioPanel />
        </OrbitDeckProvider>,
      );
    });

    expect(container.textContent).toContain('Radio & Doppler');
    expect(container.textContent).toContain('Hamlib Hardware Control');
    expect(container.textContent).toContain('Range Rate');

    root.unmount();
    container.remove();
  });

  it('renders StationModal and MapSettingsModal when open', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <OrbitDeckProvider>
          <StationModal isOpen={true} onClose={() => {}} />
          <MapSettingsModal isOpen={true} onClose={() => {}} />
        </OrbitDeckProvider>,
      );
    });

    expect(container.textContent).toContain('Ground Stations (QTH Locators)');
    expect(container.textContent).toContain('Map Engine & Layer Settings');
    expect(container.textContent).toContain('Leaflet');
    expect(container.textContent).toContain('OpenLayers');
    expect(container.textContent).toContain('MapLibre GL');
    expect(container.textContent).toContain('CesiumJS');
    expect(container.textContent).toContain('Globe.gl');

    root.unmount();
    container.remove();
  });
});
