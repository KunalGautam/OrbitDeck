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
  generateFootprintCircle,
  splitPolygonAtAntimeridian,
  splitTrackAtAntimeridian,
} from '@orbitdeck/shared';
import Feature from 'ol/Feature';
import OlMap from 'ol/Map';
import View from 'ol/View';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import Polygon from 'ol/geom/Polygon';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat, toLonLat } from 'ol/proj';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style';
import 'ol/ol.css';

export class OpenLayersAdapter implements IMapProvider {
  readonly id: MapProviderId = 'openlayers';
  readonly name = 'OpenLayers (2D Projection)';
  readonly capabilities: MapCapabilities = {
    supports3D: false,
    supportsVectorTiles: false,
    supportsTerrain: false,
    supportsCustomProjections: true,
    supportsAtmosphere: false,
  };

  private map: OlMap | null = null;
  private view: View | null = null;

  // Vector Sources
  private satSource = new VectorSource();
  private trackSource = new VectorSource();
  private footprintSource = new VectorSource();
  private stationSource = new VectorSource();
  private terminatorSource = new VectorSource();
  private celestialSource = new VectorSource();

  private satFeatures = new Map<number, Feature>();
  private onSelectSatCb: SatelliteSelectCallback = () => {};
  private onMapClickCb: MapClickCallback = () => {};
  private followedSatId: number | null = null;

  mount(container: HTMLElement, options: MapMountOptions = {}): void {
    const center = options.initialCenter || [20, 0];
    const zoom = options.initialZoom || 2;

    this.view = new View({
      center: fromLonLat([center[1], center[0]]),
      zoom,
      minZoom: 1,
      maxZoom: 19,
    });

    const tileSource = options.tileSource?.url
      ? new XYZ({
          url: options.tileSource.url,
          attributions: options.tileSource.attribution,
          maxZoom: options.tileSource.maxZoom || 19,
        })
      : new OSM({
          attributions:
            options.tileSource?.attribution ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });

    this.map = new OlMap({
      target: container,
      layers: [
        new TileLayer({ source: tileSource }),
        new VectorLayer({ source: this.footprintSource }),
        new VectorLayer({ source: this.trackSource }),
        new VectorLayer({ source: this.terminatorSource }),
        new VectorLayer({ source: this.stationSource }),
        new VectorLayer({ source: this.celestialSource }),
        new VectorLayer({ source: this.satSource }),
      ],
      view: this.view,
    });

    this.map.on('click', (evt) => {
      const coords = toLonLat(evt.coordinate);
      this.onMapClickCb({
        latitude: coords[1] ?? 0,
        longitude: coords[0] ?? 0,
      });

      const feature = this.map?.forEachFeatureAtPixel(evt.pixel, (f) => f);
      if (feature) {
        const satId = feature.get('noradId');
        if (typeof satId === 'number') {
          this.onSelectSatCb(satId);
        }
      }
    });
  }

  destroy(): void {
    if (this.map) {
      this.map.setTarget(undefined);
      this.map = null;
    }
    this.view = null;
    this.satFeatures.clear();
  }

  resize(): void {
    this.map?.updateSize();
  }

  setSatellites(frames: LiveTrackingFrame[]): void {
    if (!this.map) return;
    const activeIds = new Set(frames.map((f) => f.noradId));

    for (const [id, feat] of this.satFeatures.entries()) {
      if (!activeIds.has(id)) {
        this.satSource.removeFeature(feat);
        this.satFeatures.delete(id);
      }
    }

    for (const frame of frames) {
      const coord = fromLonLat([frame.longitude, frame.latitude]);
      let feat = this.satFeatures.get(frame.noradId);

      const color = frame.eclipseStatus === 'sunlit' ? '#00e5ff' : '#ffab00';

      if (!feat) {
        feat = new Feature({
          geometry: new Point(coord),
          noradId: frame.noradId,
        });

        feat.setStyle(
          new Style({
            image: new CircleStyle({
              radius: 6,
              fill: new Fill({ color }),
              stroke: new Stroke({ color: '#000', width: 2 }),
            }),
            text: new Text({
              text: frame.name,
              offsetY: -14,
              font: 'bold 10px sans-serif',
              fill: new Fill({ color: '#fff' }),
              backgroundFill: new Fill({ color: 'rgba(0,0,0,0.75)' }),
              padding: [2, 4, 2, 4],
            }),
          }),
        );

        this.satSource.addFeature(feat);
        this.satFeatures.set(frame.noradId, feat);
      } else {
        const geom = feat.getGeometry() as Point;
        geom.setCoordinates(coord);
      }

      if (this.followedSatId === frame.noradId && this.view) {
        this.view.setCenter(coord);
      }
    }
  }

  setGroundTrack(_satId: number, points: GroundTrackPoint[]): void {
    this.trackSource.clear();
    const segments = splitTrackAtAntimeridian(points);

    for (const seg of segments) {
      const coords = seg.map((p) => fromLonLat([p.longitude, p.latitude]));
      const feat = new Feature({ geometry: new LineString(coords) });
      feat.setStyle(
        new Style({
          stroke: new Stroke({
            color: '#00e5ff',
            width: 2,
            lineDash: [4, 4],
          }),
        }),
      );
      this.trackSource.addFeature(feat);
    }
  }

  clearGroundTrack(_satId?: number): void {
    this.trackSource.clear();
  }

  setFootprint(
    _satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void {
    this.footprintSource.clear();

    const circle = generateFootprintCircle(center.latitude, center.longitude, radiusKm, 64);
    const splitPolygons = splitPolygonAtAntimeridian(circle);

    for (const ring of splitPolygons) {
      const coords = ring.map((pt) => fromLonLat([pt[1], pt[0]]));
      // close ring
      if (coords.length > 0 && coords[0]) coords.push(coords[0]);

      const feat = new Feature({ geometry: new Polygon([coords]) });
      feat.setStyle(
        new Style({
          stroke: new Stroke({ color: '#00e5ff', width: 1.5 }),
          fill: new Fill({ color: 'rgba(0, 229, 255, 0.12)' }),
        }),
      );
      this.footprintSource.addFeature(feat);
    }
  }

  clearFootprint(_satId?: number): void {
    this.footprintSource.clear();
  }

  setStation(station: GroundStation | null): void {
    this.stationSource.clear();
    if (!station) return;

    const coord = fromLonLat([station.longitude, station.latitude]);
    const feat = new Feature({ geometry: new Point(coord) });

    feat.setStyle(
      new Style({
        image: new CircleStyle({
          radius: 7,
          fill: new Fill({ color: '#00e676' }),
          stroke: new Stroke({ color: '#000', width: 2 }),
        }),
        text: new Text({
          text: `${station.name} (${station.maidenhead})`,
          offsetY: -16,
          font: 'bold 10px sans-serif',
          fill: new Fill({ color: '#00e676' }),
          backgroundFill: new Fill({ color: 'rgba(0,0,0,0.8)' }),
          padding: [2, 4, 2, 4],
        }),
      }),
    );

    this.stationSource.addFeature(feat);
  }

  setTerminator(polygon: [number, number][][]): void {
    this.terminatorSource.clear();
    for (const ring of polygon) {
      const coords = ring.map((pt) => fromLonLat([pt[1], pt[0]]));
      if (coords.length > 0 && coords[0]) coords.push(coords[0]);

      const feat = new Feature({ geometry: new Polygon([coords]) });
      feat.setStyle(
        new Style({
          fill: new Fill({ color: 'rgba(0, 0, 0, 0.35)' }),
        }),
      );
      this.terminatorSource.addFeature(feat);
    }
  }

  setSunMoon(positions: CelestialPosition[]): void {
    this.celestialSource.clear();
    for (const pos of positions) {
      const emoji = pos.type === 'sun' ? '☀️' : '🌙';
      const coord = fromLonLat([pos.longitude, pos.latitude]);
      const feat = new Feature({ geometry: new Point(coord) });

      feat.setStyle(
        new Style({
          text: new Text({
            text: emoji,
            font: '18px sans-serif',
          }),
        }),
      );
      this.celestialSource.addFeature(feat);
    }
  }

  onSelectSatellite(cb: SatelliteSelectCallback): void {
    this.onSelectSatCb = cb;
  }

  onMapClick(cb: MapClickCallback): void {
    this.onMapClickCb = cb;
  }

  flyTo(target: CameraTarget): void {
    if (!this.view) return;
    this.view.animate({
      center: fromLonLat([target.longitude, target.latitude]),
      zoom: target.zoom || 4,
      duration: target.durationMs || 1000,
    });
  }

  followSatellite(satId: number | null): void {
    this.followedSatId = satId;
  }
}
