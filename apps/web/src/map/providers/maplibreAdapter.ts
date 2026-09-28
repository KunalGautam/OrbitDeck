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
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export class MapLibreAdapter implements IMapProvider {
  readonly id: MapProviderId = 'maplibre';
  readonly name = 'MapLibre GL (2D Vector/Raster)';
  readonly capabilities: MapCapabilities = {
    supports3D: false,
    supportsVectorTiles: true,
    supportsTerrain: false,
    supportsCustomProjections: false,
    supportsAtmosphere: false,
  };

  private map: MapLibreMap | null = null;

  private satMarkers = new Map<number, Marker>();
  private stationMarker: Marker | null = null;
  private celestialMarkers: Marker[] = [];

  private onSelectSatCb: SatelliteSelectCallback = () => {};
  private onMapClickCb: MapClickCallback = () => {};
  private followedSatId: number | null = null;
  private isLoaded = false;

  mount(container: HTMLElement, options: MapMountOptions = {}): void {
    container.innerHTML = '';

    const center = options.initialCenter || [20, 0];
    const zoom = options.initialZoom || 1.5;

    const rawUrl =
      options.tileSource?.url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    const subdomains =
      options.tileSource?.subdomains && options.tileSource.subdomains.length > 0
        ? options.tileSource.subdomains
        : ['a', 'b', 'c', 'd'];

    // MapLibre raster tiles require an array of resolved URLs without unexpanded {s}
    const tiles = rawUrl.includes('{s}')
      ? subdomains.map((s) => rawUrl.replace('{s}', s))
      : [rawUrl];

    // Standard raster tile style spec for MapLibre with background color fallback
    const style: any = {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles,
          tileSize: 256,
          attribution:
            options.tileSource?.attribution ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      },
      layers: [
        {
          id: 'background-layer',
          type: 'background',
          paint: {
            'background-color': '#080c16',
          },
        },
        {
          id: 'osm-tiles-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    };

    this.map = new maplibregl.Map({
      container,
      style,
      center: [center[1], center[0]],
      zoom,
      maxZoom: 18,
    });

    this.map.on('load', () => {
      this.isLoaded = true;
      this.setupVectorLayers();
      this.map?.resize();
    });

    this.map.on('error', (e) => {
      console.warn('MapLibre GL warning:', e);
    });

    this.map.on('click', (e) => {
      this.onMapClickCb({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    });
  }

  private setupVectorLayers(): void {
    if (!this.map) return;

    // Track Source & Layer
    if (!this.map.getSource('track-source')) {
      this.map.addSource('track-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      this.map.addLayer({
        id: 'track-layer',
        type: 'line',
        source: 'track-source',
        paint: {
          'line-color': '#00e5ff',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Footprint Source & Layer
    if (!this.map.getSource('footprint-source')) {
      this.map.addSource('footprint-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      this.map.addLayer({
        id: 'footprint-layer-fill',
        type: 'fill',
        source: 'footprint-source',
        paint: {
          'fill-color': '#00e5ff',
          'fill-opacity': 0.12,
        },
      });
      this.map.addLayer({
        id: 'footprint-layer-line',
        type: 'line',
        source: 'footprint-source',
        paint: {
          'line-color': '#00e5ff',
          'line-width': 1.5,
        },
      });
    }

    // Terminator Source & Layer
    if (!this.map.getSource('terminator-source')) {
      this.map.addSource('terminator-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      this.map.addLayer({
        id: 'terminator-layer',
        type: 'fill',
        source: 'terminator-source',
        paint: {
          'fill-color': '#000',
          'fill-opacity': 0.35,
        },
      });
    }
  }

  destroy(): void {
    for (const marker of this.satMarkers.values()) {
      marker.remove();
    }
    this.satMarkers.clear();

    for (const m of this.celestialMarkers) {
      m.remove();
    }
    this.celestialMarkers = [];

    if (this.stationMarker) {
      this.stationMarker.remove();
      this.stationMarker = null;
    }

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.isLoaded = false;
  }

  resize(): void {
    this.map?.resize();
  }

  setSatellites(frames: LiveTrackingFrame[]): void {
    if (!this.map) return;
    const activeIds = new Set(frames.map((f) => f.noradId));

    for (const [id, marker] of this.satMarkers.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.satMarkers.delete(id);
      }
    }

    for (const frame of frames) {
      let marker = this.satMarkers.get(frame.noradId);
      const color = frame.eclipseStatus === 'sunlit' ? '#00e5ff' : '#ffab00';

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'orbitdeck-sat-marker';
        el.style.cursor = 'pointer';
        el.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%);">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="${color}" stroke="#000" stroke-width="1.5">
              <circle cx="12" cy="12" r="5" />
              <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
              <rect x="2" y="9" width="4" height="6" rx="1" fill="#fff" />
              <rect x="18" y="9" width="4" height="6" rx="1" fill="#fff" />
            </svg>
            <span style="font-size:10px; font-weight:700; color:#fff; background:rgba(0,0,0,0.75); padding:1px 4px; border-radius:3px; white-space:nowrap; margin-top:2px;">
              ${frame.name}
            </span>
          </div>
        `;

        el.addEventListener('click', () => {
          this.onSelectSatCb(frame.noradId);
        });

        marker = new maplibregl.Marker({ element: el })
          .setLngLat([frame.longitude, frame.latitude])
          .addTo(this.map);

        this.satMarkers.set(frame.noradId, marker);
      } else {
        marker.setLngLat([frame.longitude, frame.latitude]);
      }

      if (this.followedSatId === frame.noradId) {
        this.map.panTo([frame.longitude, frame.latitude]);
      }
    }
  }

  setGroundTrack(_satId: number, points: GroundTrackPoint[]): void {
    if (!this.map || !this.isLoaded) return;
    const source = this.map.getSource('track-source') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const segments = splitTrackAtAntimeridian(points);
    const features: any[] = segments.map((seg) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: seg.map((p) => [p.longitude, p.latitude]),
      },
    }));

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }

  clearGroundTrack(_satId?: number): void {
    if (!this.map || !this.isLoaded) return;
    const source = this.map.getSource('track-source') as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: [] });
  }

  setFootprint(
    _satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void {
    if (!this.map || !this.isLoaded) return;
    const source = this.map.getSource('footprint-source') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const circle = generateFootprintCircle(center.latitude, center.longitude, radiusKm, 64);
    const splitPolygons = splitPolygonAtAntimeridian(circle);

    const features: any[] = splitPolygons.map((ring) => {
      const coords = ring.map((pt) => [pt[1], pt[0]]);
      if (coords.length > 0 && coords[0]) coords.push(coords[0]);
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }

  clearFootprint(_satId?: number): void {
    if (!this.map || !this.isLoaded) return;
    const source = this.map.getSource('footprint-source') as maplibregl.GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: [] });
  }

  setStation(station: GroundStation | null): void {
    if (!this.map) return;
    if (this.stationMarker) {
      this.stationMarker.remove();
      this.stationMarker = null;
    }

    if (!station) return;

    const el = document.createElement('div');
    el.className = 'orbitdeck-qth-marker';
    el.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#00e676" stroke="#000" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="3" fill="#fff"/>
        </svg>
        <span style="font-size:10px; font-weight:700; color:#00e676; background:rgba(0,0,0,0.8); padding:1px 4px; border-radius:3px; white-space:nowrap; margin-top:2px;">
          ${station.name} (${station.maidenhead})
        </span>
      </div>
    `;

    this.stationMarker = new maplibregl.Marker({ element: el })
      .setLngLat([station.longitude, station.latitude])
      .addTo(this.map);
  }

  setTerminator(polygon: [number, number][][]): void {
    if (!this.map || !this.isLoaded) return;
    const source = this.map.getSource('terminator-source') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: any[] = polygon.map((ring) => {
      const coords = ring.map((pt) => [pt[1], pt[0]]);
      if (coords.length > 0 && coords[0]) coords.push(coords[0]);
      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }

  setSunMoon(positions: CelestialPosition[]): void {
    if (!this.map) return;
    for (const m of this.celestialMarkers) {
      m.remove();
    }
    this.celestialMarkers = [];

    for (const pos of positions) {
      const emoji = pos.type === 'sun' ? '☀️' : '🌙';
      const el = document.createElement('div');
      el.innerHTML = `<span style="font-size:18px;">${emoji}</span>`;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pos.longitude, pos.latitude])
        .addTo(this.map);

      this.celestialMarkers.push(marker);
    }
  }

  onSelectSatellite(cb: SatelliteSelectCallback): void {
    this.onSelectSatCb = cb;
  }

  onMapClick(cb: MapClickCallback): void {
    this.onMapClickCb = cb;
  }

  flyTo(target: CameraTarget): void {
    if (!this.map) return;
    this.map.flyTo({
      center: [target.longitude, target.latitude],
      zoom: target.zoom || 3,
      duration: target.durationMs || 1000,
    });
  }

  followSatellite(satId: number | null): void {
    this.followedSatId = satId;
  }
}
