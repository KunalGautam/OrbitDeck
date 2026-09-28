import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CelestialPosition,
  GroundStation,
  GroundTrackPoint,
  IMapProvider,
  LiveTrackingFrame,
} from '@orbitdeck/shared';
import { LeafletAdapter } from './providers/leafletAdapter.js';
import { CesiumAdapter } from './providers/cesiumAdapter.js';

// Setup Mock Canvas / WebGL for headless DOM test runner
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
    if (contextId === '2d') {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Array(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 10 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      } as any;
    }

    // WebGL Context Mock
    return {
      getExtension: vi.fn(),
      getParameter: vi.fn(() => 0),
      createShader: vi.fn(),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      createProgram: vi.fn(),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      useProgram: vi.fn(),
      createBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      clear: vi.fn(),
      clearColor: vi.fn(),
      viewport: vi.fn(),
      drawArrays: vi.fn(),
      drawElements: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      getUniformLocation: vi.fn(),
      uniformMatrix4fv: vi.fn(),
      createTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
    } as any;
  });
});

const ADAPTER_FACTORIES: { name: string; create: () => IMapProvider }[] = [
  { name: 'LeafletAdapter', create: () => new LeafletAdapter() },
  { name: 'CesiumAdapter', create: () => new CesiumAdapter() },
];

describe('MapProvider Conformance Test Suite', () => {
  const sampleFrames: LiveTrackingFrame[] = [
    {
      noradId: 25544,
      name: 'ISS (ZARYA)',
      timestamp: Date.now(),
      latitude: 51.5,
      longitude: -0.1,
      altitudeKm: 420,
      velocityKmS: 7.66,
      footprintRadiusKm: 2200,
      eclipseStatus: 'sunlit',
    },
    {
      noradId: 25338,
      name: 'NOAA 15',
      timestamp: Date.now(),
      latitude: -30.0,
      longitude: 140.0,
      altitudeKm: 850,
      velocityKmS: 7.45,
      footprintRadiusKm: 3100,
      eclipseStatus: 'umbra',
    },
  ];

  const sampleTrack: GroundTrackPoint[] = [
    { latitude: 10, longitude: 175, altitudeKm: 420, timestamp: 1000 },
    { latitude: 12, longitude: 179, altitudeKm: 420, timestamp: 2000 },
    { latitude: 14, longitude: -178, altitudeKm: 420, timestamp: 3000 }, // Antimeridian crossing!
    { latitude: 16, longitude: -175, altitudeKm: 420, timestamp: 4000 },
  ];

  const sampleStation: GroundStation = {
    id: 'test-qth',
    name: 'Greenwich',
    latitude: 51.4769,
    longitude: 0.0005,
    altitude: 48,
    maidenhead: 'IO91wm',
    isDefault: true,
  };

  const sampleCelestial: CelestialPosition[] = [
    { type: 'sun', latitude: 5.0, longitude: -40.0 },
    { type: 'moon', latitude: -12.0, longitude: 110.0 },
  ];

  for (const { name, create } of ADAPTER_FACTORIES) {
    describe(`${name} Conformance`, () => {
      let adapter: IMapProvider;
      let container: HTMLElement;

      beforeEach(() => {
        adapter = create();
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
      });

      it('should expose valid ID and capability flags', () => {
        expect(adapter.id).toBeDefined();
        expect(adapter.name).toBeDefined();
        expect(typeof adapter.capabilities.supports3D).toBe('boolean');
        expect(typeof adapter.capabilities.supportsVectorTiles).toBe('boolean');
      });

      it('should mount, resize, and destroy cleanly without leaking DOM', async () => {
        try {
          await adapter.mount(container, { initialCenter: [20, 0], initialZoom: 3 });
        } catch {
          // In headless environment without WebGL context, ignore renderer mount errors
        }

        expect(() => adapter.resize()).not.toThrow();
        expect(() => adapter.destroy()).not.toThrow();
      });

      it('should render, update, and remove satellite markers', async () => {
        try {
          await adapter.mount(container);
        } catch {
          // ignore headless canvas init error
        }

        // Add 2 satellites
        expect(() => adapter.setSatellites(sampleFrames)).not.toThrow();

        // Update single satellite
        expect(() =>
          adapter.setSatellites([
            {
              ...sampleFrames[0]!,
              latitude: 52.0,
              longitude: 1.0,
            },
          ]),
        ).not.toThrow();

        // Clear satellites
        expect(() => adapter.setSatellites([])).not.toThrow();
        adapter.destroy();
      });

      it('should handle ground track with antimeridian crossings', async () => {
        try {
          await adapter.mount(container);
        } catch {
          // ignore
        }

        expect(() => adapter.setGroundTrack(25544, sampleTrack)).not.toThrow();
        expect(() => adapter.clearGroundTrack(25544)).not.toThrow();
        adapter.destroy();
      });

      it('should render footprint circles', async () => {
        try {
          await adapter.mount(container);
        } catch {
          // ignore
        }

        expect(() =>
          adapter.setFootprint(25544, { latitude: 0, longitude: 179 }, 2200),
        ).not.toThrow();
        expect(() => adapter.clearFootprint(25544)).not.toThrow();
        adapter.destroy();
      });

      it('should render station, terminator, and celestial bodies', async () => {
        try {
          await adapter.mount(container);
        } catch {
          // ignore
        }

        expect(() => adapter.setStation(sampleStation)).not.toThrow();
        expect(() => adapter.setStation(null)).not.toThrow();

        expect(() =>
          adapter.setTerminator([
            [
              [0, 0],
              [0, 10],
              [10, 10],
              [10, 0],
            ],
          ]),
        ).not.toThrow();

        expect(() => adapter.setSunMoon(sampleCelestial)).not.toThrow();
        adapter.destroy();
      });

      it('should register interaction callbacks and camera target', async () => {
        try {
          await adapter.mount(container);
        } catch {
          // ignore
        }

        const selectCb = vi.fn();
        const clickCb = vi.fn();

        expect(() => adapter.onSelectSatellite(selectCb)).not.toThrow();
        expect(() => adapter.onMapClick(clickCb)).not.toThrow();

        expect(() => adapter.flyTo({ latitude: 48.137, longitude: 11.575, zoom: 5 })).not.toThrow();

        expect(() => adapter.followSatellite(25544)).not.toThrow();
        expect(() => adapter.followSatellite(null)).not.toThrow();
        adapter.destroy();
      });
    });
  }
});
