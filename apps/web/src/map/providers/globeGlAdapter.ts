import {
  type CameraTarget,
  type CelestialPosition,
  type GroundStation,
  type GroundTrackPoint,
  type IMapProvider,
  type LiveTrackingFrame,
  type MapCapabilities,
  type MapClickCallback,
  type MapMountOptions,
  type MapProviderId,
  type SatelliteSelectCallback,
} from '@orbitdeck/shared';
import Globe, { type GlobeInstance } from 'globe.gl';

export class GlobeGlAdapter implements IMapProvider {
  readonly id: MapProviderId = 'globegl';
  readonly name = 'Globe.gl (Lightweight 3D)';
  readonly capabilities: MapCapabilities = {
    supports3D: true,
    supportsVectorTiles: false,
    supportsTerrain: false,
    supportsCustomProjections: false,
    supportsAtmosphere: true,
  };

  private globe: GlobeInstance | null = null;
  private container: HTMLElement | null = null;

  private onSelectSatCb: SatelliteSelectCallback = () => {};
  private onMapClickCb: MapClickCallback = () => {};
  private followedSatId: number | null = null;

  // Cached data
  private satellitesData: any[] = [];
  private pathsData: any[] = [];
  private ringsData: any[] = [];
  private stationData: any[] = [];
  private celestialData: any[] = [];

  mount(container: HTMLElement, options: MapMountOptions = {}): void {
    this.container = container;

    const globe = new Globe(container);
    this.globe = globe;

    // Use photorealistic NASA Blue Marble or dark globe imagery
    const imgUrl = 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg';

    globe
      .globeImageUrl(imgUrl)
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#00e5ff')
      .atmosphereAltitude(0.15);

    // Labels for Satellites & Stations
    globe
      .labelsData([])
      .labelLat((d: any) => d.lat)
      .labelLng((d: any) => d.lng)
      .labelAltitude((d: any) => d.alt || 0)
      .labelText((d: any) => d.name)
      .labelSize(1.2)
      .labelDotRadius(0.5)
      .labelColor((d: any) => d.color || '#00e5ff')
      .onLabelClick((label: any) => {
        if (typeof label.noradId === 'number') {
          this.onSelectSatCb(label.noradId);
        }
      });

    // Paths for Ground Tracks
    globe
      .pathsData([])
      .pathPoints((d: any) => d.coords)
      .pathPointLat((p: any) => p.lat)
      .pathPointLng((p: any) => p.lng)
      .pathPointAlt((p: any) => p.alt)
      .pathColor(() => '#00e5ff')
      .pathDashLength(0.01)
      .pathDashGap(0.005)
      .pathDashAnimateTime(0);

    // Rings for Footprints
    globe
      .ringsData([])
      .ringLat((d: any) => d.lat)
      .ringLng((d: any) => d.lng)
      .ringAltitude(0.001)
      .ringMaxRadius((d: any) => d.maxR)
      .ringPropagationSpeed(0)
      .ringRepeatPeriod(0)
      .ringColor(() => '#00e5ff');

    globe.onGlobeClick((coords) => {
      this.onMapClickCb({ latitude: coords.lat, longitude: coords.lng });
    });

    const center = options.initialCenter || [20, 0];
    globe.pointOfView({ lat: center[0], lng: center[1], altitude: 2.5 });
  }

  destroy(): void {
    if (this.globe) {
      this.globe._destructor();
      this.globe = null;
    }
    this.satellitesData = [];
    this.pathsData = [];
    this.ringsData = [];
    this.stationData = [];
    this.container = null;
  }

  resize(): void {
    if (this.container && this.globe) {
      this.globe.width(this.container.clientWidth);
      this.globe.height(this.container.clientHeight);
    }
  }

  setSatellites(frames: LiveTrackingFrame[]): void {
    if (!this.globe) return;

    this.satellitesData = frames.map((f) => ({
      noradId: f.noradId,
      name: f.name,
      lat: f.latitude,
      lng: f.longitude,
      alt: Math.min(1.0, f.altitudeKm / 6371), // relative altitude
      color: f.eclipseStatus === 'sunlit' ? '#00e5ff' : '#ffab00',
    }));

    const combinedLabels = [...this.satellitesData, ...this.stationData, ...this.celestialData];
    this.globe.labelsData(combinedLabels);

    if (this.followedSatId) {
      const target = frames.find((f) => f.noradId === this.followedSatId);
      if (target) {
        this.globe.pointOfView({ lat: target.latitude, lng: target.longitude }, 500);
      }
    }
  }

  setGroundTrack(_satId: number, points: GroundTrackPoint[]): void {
    if (!this.globe) return;

    const coords = points.map((p) => ({
      lat: p.latitude,
      lng: p.longitude,
      alt: Math.min(1.0, (p.altitudeKm || 400) / 6371),
    }));

    this.pathsData = [{ coords }];
    this.globe.pathsData(this.pathsData);
  }

  clearGroundTrack(_satId?: number): void {
    if (!this.globe) return;
    this.pathsData = [];
    this.globe.pathsData([]);
  }

  setFootprint(
    _satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void {
    if (!this.globe) return;

    // Radius in degrees approx: radiusKm / 111.32
    const radiusDeg = radiusKm / 111.32;
    this.ringsData = [{ lat: center.latitude, lng: center.longitude, maxR: radiusDeg }];
    this.globe.ringsData(this.ringsData);
  }

  clearFootprint(_satId?: number): void {
    if (!this.globe) return;
    this.ringsData = [];
    this.globe.ringsData([]);
  }

  setStation(station: GroundStation | null): void {
    if (!this.globe) return;
    if (!station) {
      this.stationData = [];
    } else {
      this.stationData = [
        {
          name: `📡 ${station.name}`,
          lat: station.latitude,
          lng: station.longitude,
          alt: 0,
          color: '#00e676',
        },
      ];
    }

    const combinedLabels = [...this.satellitesData, ...this.stationData, ...this.celestialData];
    this.globe.labelsData(combinedLabels);
  }

  setTerminator(_polygon: [number, number][][]): void {
    // globe.gl renders atmosphere and sun angles automatically
  }

  setSunMoon(positions: CelestialPosition[]): void {
    if (!this.globe) return;

    this.celestialData = positions.map((p) => ({
      name: p.type === 'sun' ? '☀️' : '🌙',
      lat: p.latitude,
      lng: p.longitude,
      alt: 0.1,
      color: '#ffffff',
    }));

    const combinedLabels = [...this.satellitesData, ...this.stationData, ...this.celestialData];
    this.globe.labelsData(combinedLabels);
  }

  onSelectSatellite(cb: SatelliteSelectCallback): void {
    this.onSelectSatCb = cb;
  }

  onMapClick(cb: MapClickCallback): void {
    this.onMapClickCb = cb;
  }

  flyTo(target: CameraTarget): void {
    if (!this.globe) return;
    this.globe.pointOfView(
      {
        lat: target.latitude,
        lng: target.longitude,
        altitude: target.altitudeKm ? target.altitudeKm / 6371 + 1 : 2.0,
      },
      target.durationMs || 1000,
    );
  }

  followSatellite(satId: number | null): void {
    this.followedSatId = satId;
  }
}
