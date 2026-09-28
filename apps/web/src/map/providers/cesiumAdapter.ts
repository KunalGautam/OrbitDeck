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
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Ensure Cesium static assets base URL is defined with trailing slash
if (typeof window !== 'undefined' && !(window as any).CESIUM_BASE_URL) {
  (window as any).CESIUM_BASE_URL = '/cesium/';
}

export class CesiumAdapter implements IMapProvider {
  readonly id: MapProviderId = 'cesium';
  readonly name = 'CesiumJS (3D Globe)';
  readonly capabilities: MapCapabilities = {
    supports3D: true,
    supportsVectorTiles: false,
    supportsTerrain: true,
    supportsCustomProjections: false,
    supportsAtmosphere: true,
  };

  private viewer: Cesium.Viewer | null = null;

  // Entities maps
  private satEntities = new Map<number, Cesium.Entity>();
  private trackEntity: Cesium.Entity | null = null;
  private footprintEntity: Cesium.Entity | null = null;
  private stationEntity: Cesium.Entity | null = null;
  private celestialEntities: Cesium.Entity[] = [];

  private onSelectSatCb: SatelliteSelectCallback = () => {};
  private onMapClickCb: MapClickCallback = () => {};
  private followedSatId: number | null = null;

  mount(container: HTMLElement, options: MapMountOptions = {}): void {
    container.innerHTML = '';

    if (typeof window !== 'undefined' && !(window as any).CESIUM_BASE_URL) {
      (window as any).CESIUM_BASE_URL = '/cesium/';
    }

    // Optional Cesium Ion token or empty string for offline/free OSM imagery
    Cesium.Ion.defaultAccessToken = options.cesiumIonToken || '';

    const isOsm =
      !options.tileSource ||
      options.tileSource.id === 'osm-standard' ||
      options.tileSource.url.includes('tile.openstreetmap.org');

    let imageryProvider: Cesium.ImageryProvider;

    if (isOsm) {
      imageryProvider = new Cesium.OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
        credit: new Cesium.Credit(
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
          true,
        ),
        maximumLevel: 19,
      });
    } else {
      const tileSource = options.tileSource!;
      const hasSubdomains =
        tileSource.url.includes('{s}') &&
        Boolean(tileSource.subdomains && tileSource.subdomains.length > 0);

      imageryProvider = new Cesium.UrlTemplateImageryProvider({
        url: tileSource.url,
        subdomains: hasSubdomains ? tileSource.subdomains : undefined,
        credit: new Cesium.Credit(tileSource.attribution, true),
        maximumLevel: tileSource.maxZoom || 19,
      });
    }

    imageryProvider.errorEvent.addEventListener((error) => {
      console.warn('Cesium imagery tile error:', error);
    });

    this.viewer = new Cesium.Viewer(container, {
      baseLayer: new Cesium.ImageryLayer(imageryProvider),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: true,
      selectionIndicator: false,
      timeline: false,
      animation: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      showRenderLoopErrors: false,
    });

    // Suppress render crashes from transient image decode / network errors
    this.viewer.scene.renderError.addEventListener((_scene, error) => {
      console.warn('Cesium render loop recovered from error:', error);
    });

    const handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (!this.viewer) return;
      const pickedObject = this.viewer.scene.pick(click.position);

      if (Cesium.defined(pickedObject) && pickedObject.id) {
        const satId = pickedObject.id.properties?.noradId?.getValue();
        if (typeof satId === 'number') {
          this.onSelectSatCb(satId);
          return;
        }
      }

      // Map click coordinate
      const ray = this.viewer.camera.getPickRay(click.position);
      if (ray) {
        const cartesian = this.viewer.scene.globe.pick(ray, this.viewer.scene);
        if (cartesian) {
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          this.onMapClickCb({
            latitude: Cesium.Math.toDegrees(cartographic.latitude),
            longitude: Cesium.Math.toDegrees(cartographic.longitude),
          });
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Initial camera
    const center = options.initialCenter || [20, 0];
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(center[1], center[0], 20000000),
    });
  }

  destroy(): void {
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.destroy();
      this.viewer = null;
    }
    this.satEntities.clear();
    this.celestialEntities = [];
  }

  resize(): void {
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.resize();
    }
  }

  setSatellites(frames: LiveTrackingFrame[]): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    const activeIds = new Set(frames.map((f) => f.noradId));

    for (const [id, entity] of this.satEntities.entries()) {
      if (!activeIds.has(id)) {
        this.viewer.entities.remove(entity);
        this.satEntities.delete(id);
      }
    }

    for (const frame of frames) {
      const position = Cesium.Cartesian3.fromDegrees(
        frame.longitude,
        frame.latitude,
        frame.altitudeKm * 1000,
      );

      let entity = this.satEntities.get(frame.noradId);
      const color =
        frame.eclipseStatus === 'sunlit'
          ? Cesium.Color.fromCssColorString('#00e5ff')
          : Cesium.Color.fromCssColorString('#ffab00');

      if (!entity) {
        entity = this.viewer.entities.add({
          position,
          point: {
            pixelSize: 8,
            color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
          },
          label: {
            text: frame.name,
            font: '11px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
          },
          properties: {
            noradId: frame.noradId,
          },
        });
        this.satEntities.set(frame.noradId, entity);
      } else {
        entity.position = new Cesium.ConstantPositionProperty(position);
        if (entity.point) {
          entity.point.color = new Cesium.ConstantProperty(color);
        }
      }

      if (this.followedSatId === frame.noradId) {
        this.viewer.camera.lookAt(
          position,
          new Cesium.HeadingPitchRange(0, -Cesium.Math.PI_OVER_FOUR, 5000000),
        );
      }
    }
  }

  setGroundTrack(_satId: number, points: GroundTrackPoint[]): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.trackEntity) {
      this.viewer.entities.remove(this.trackEntity);
      this.trackEntity = null;
    }

    const positions = points.map((p) =>
      Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, (p.altitudeKm || 400) * 1000),
    );

    this.trackEntity = this.viewer.entities.add({
      polyline: {
        positions,
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#00e5ff'),
        }),
        arcType: Cesium.ArcType.GEODESIC,
      },
    });
  }

  clearGroundTrack(_satId?: number): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.trackEntity) {
      this.viewer.entities.remove(this.trackEntity);
      this.trackEntity = null;
    }
  }

  setFootprint(
    _satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.footprintEntity) {
      this.viewer.entities.remove(this.footprintEntity);
      this.footprintEntity = null;
    }

    const radiusMeters = radiusKm * 1000;

    this.footprintEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude, 0),
      ellipse: {
        semiMajorAxis: radiusMeters,
        semiMinorAxis: radiusMeters,
        material: Cesium.Color.fromCssColorString('#00e5ff').withAlpha(0.15),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00e5ff'),
        outlineWidth: 2,
      },
    });
  }

  clearFootprint(_satId?: number): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.footprintEntity) {
      this.viewer.entities.remove(this.footprintEntity);
      this.footprintEntity = null;
    }
  }

  setStation(station: GroundStation | null): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    if (this.stationEntity) {
      this.viewer.entities.remove(this.stationEntity);
      this.stationEntity = null;
    }

    if (!station) return;

    this.stationEntity = this.viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(
        station.longitude,
        station.latitude,
        station.altitude || 0,
      ),
      point: {
        pixelSize: 10,
        color: Cesium.Color.fromCssColorString('#00e676'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
      },
      label: {
        text: `${station.name} (${station.maidenhead})`,
        font: 'bold 11px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#00e676'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -16),
      },
    });
  }

  setTerminator(_polygon: [number, number][][]): void {
    // Cesium globe automatically calculates day/night lighting via enableLighting = true!
    if (this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.scene.globe.enableLighting = true;
    }
  }

  setSunMoon(positions: CelestialPosition[]): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    for (const entity of this.celestialEntities) {
      this.viewer.entities.remove(entity);
    }
    this.celestialEntities = [];

    for (const pos of positions) {
      const emoji = pos.type === 'sun' ? '☀️' : '🌙';
      const entity = this.viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(pos.longitude, pos.latitude, 0),
        label: {
          text: emoji,
          font: '20px sans-serif',
        },
      });
      this.celestialEntities.push(entity);
    }
  }

  onSelectSatellite(cb: SatelliteSelectCallback): void {
    this.onSelectSatCb = cb;
  }

  onMapClick(cb: MapClickCallback): void {
    this.onMapClickCb = cb;
  }

  flyTo(target: CameraTarget): void {
    if (!this.viewer || this.viewer.isDestroyed()) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        target.longitude,
        target.latitude,
        (target.altitudeKm || 15000) * 1000,
      ),
      duration: (target.durationMs || 1000) / 1000,
    });
  }

  followSatellite(satId: number | null): void {
    this.followedSatId = satId;
    if (!satId && this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }
}
