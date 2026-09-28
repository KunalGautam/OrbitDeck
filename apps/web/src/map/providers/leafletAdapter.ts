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
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class LeafletAdapter implements IMapProvider {
  readonly id: MapProviderId = 'leaflet';
  readonly name = 'Leaflet (2D Raster)';
  readonly capabilities: MapCapabilities = {
    supports3D: false,
    supportsVectorTiles: false,
    supportsTerrain: false,
    supportsCustomProjections: true,
    supportsAtmosphere: false,
  };

  private map: L.Map | null = null;

  // Layers
  private satelliteLayer = L.layerGroup();
  private trackLayer = L.layerGroup();
  private footprintLayer = L.layerGroup();
  private stationLayer = L.layerGroup();
  private terminatorLayer = L.layerGroup();
  private celestialLayer = L.layerGroup();

  // Markers cache
  private satelliteMarkers = new Map<number, L.Marker>();

  // Callbacks
  private onSelectSatCb: SatelliteSelectCallback = () => {};
  private onMapClickCb: MapClickCallback = () => {};

  private followedSatId: number | null = null;

  mount(container: HTMLElement, options: MapMountOptions = {}): void {
    container.innerHTML = '';

    const center = options.initialCenter || [20, 0];
    const zoom = options.initialZoom || 2;

    this.map = L.map(container, {
      center: center as [number, number],
      zoom,
      minZoom: 1,
      maxZoom: 18,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: true,
    });

    // Add Zoom control to bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    const tileUrl =
      options.tileSource?.url || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    const attribution =
      options.tileSource?.attribution ||
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    const tileLayer = L.tileLayer(tileUrl, {
      attribution,
      maxZoom: options.tileSource?.maxZoom || 19,
      subdomains: options.tileSource?.subdomains || ['a', 'b', 'c', 'd'],
    });
    tileLayer.addTo(this.map);

    // Add layer groups
    this.footprintLayer.addTo(this.map);
    this.trackLayer.addTo(this.map);
    this.terminatorLayer.addTo(this.map);
    this.stationLayer.addTo(this.map);
    this.celestialLayer.addTo(this.map);
    this.satelliteLayer.addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.onMapClickCb({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
  }

  destroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.satelliteMarkers.clear();
  }

  resize(): void {
    this.map?.invalidateSize();
  }

  setSatellites(frames: LiveTrackingFrame[]): void {
    if (!this.map) return;

    const activeIds = new Set(frames.map((f) => f.noradId));

    // Remove obsolete markers
    for (const [id, marker] of this.satelliteMarkers.entries()) {
      if (!activeIds.has(id)) {
        this.satelliteLayer.removeLayer(marker);
        this.satelliteMarkers.delete(id);
      }
    }

    for (const frame of frames) {
      const latlng: [number, number] = [frame.latitude, frame.longitude];
      let marker = this.satelliteMarkers.get(frame.noradId);

      const color = frame.eclipseStatus === 'sunlit' ? '#00e5ff' : '#ffab00';

      if (!marker) {
        const icon = L.divIcon({
          className: 'orbitdeck-sat-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -50%); cursor:pointer;">
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
          `,
          iconSize: [24, 24],
        });

        marker = L.marker(latlng, { icon });
        marker.on('click', () => {
          this.onSelectSatCb(frame.noradId);
        });

        this.satelliteLayer.addLayer(marker);
        this.satelliteMarkers.set(frame.noradId, marker);
      } else {
        marker.setLatLng(latlng);
      }

      // If this satellite is being followed, keep camera centered
      if (this.followedSatId === frame.noradId) {
        this.map.panTo(latlng, { animate: true });
      }
    }
  }

  setGroundTrack(_satId: number, points: GroundTrackPoint[]): void {
    if (!this.map) return;
    this.trackLayer.clearLayers();

    // Antimeridian split
    const segments = splitTrackAtAntimeridian(points);

    for (const seg of segments) {
      const latlngs: [number, number][] = seg.map((p) => [p.latitude, p.longitude]);
      const polyline = L.polyline(latlngs, {
        color: '#00e5ff',
        weight: 2,
        opacity: 0.8,
        dashArray: '4, 4',
      });
      this.trackLayer.addLayer(polyline);
    }
  }

  clearGroundTrack(_satId?: number): void {
    this.trackLayer.clearLayers();
  }

  setFootprint(
    _satId: number,
    center: { latitude: number; longitude: number },
    radiusKm: number,
  ): void {
    if (!this.map) return;
    this.footprintLayer.clearLayers();

    const circle = generateFootprintCircle(center.latitude, center.longitude, radiusKm, 64);
    const splitPolygons = splitPolygonAtAntimeridian(circle);

    for (const polyCoords of splitPolygons) {
      const polygon = L.polygon(polyCoords, {
        color: '#00e5ff',
        weight: 1.5,
        fillColor: '#00e5ff',
        fillOpacity: 0.12,
      });
      this.footprintLayer.addLayer(polygon);
    }
  }

  clearFootprint(_satId?: number): void {
    this.footprintLayer.clearLayers();
  }

  setStation(station: GroundStation | null): void {
    if (!this.map) return;
    this.stationLayer.clearLayers();

    if (!station) return;

    const icon = L.divIcon({
      className: 'orbitdeck-qth-marker',
      html: `
        <div style="display:flex; flex-direction:column; align-items:center; transform:translate(-50%, -100%);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#00e676" stroke="#000" stroke-width="1.5">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="3" fill="#fff"/>
          </svg>
          <span style="font-size:10px; font-weight:700; color:#00e676; background:rgba(0,0,0,0.8); padding:1px 4px; border-radius:3px; white-space:nowrap; margin-top:2px;">
            ${station.name} (${station.maidenhead})
          </span>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 24],
    });

    const marker = L.marker([station.latitude, station.longitude], { icon });
    this.stationLayer.addLayer(marker);
  }

  setTerminator(polygon: [number, number][][]): void {
    if (!this.map) return;
    this.terminatorLayer.clearLayers();

    for (const ring of polygon) {
      const poly = L.polygon(ring, {
        color: '#000',
        weight: 1,
        fillColor: '#000',
        fillOpacity: 0.35,
        interactive: false,
      });
      this.terminatorLayer.addLayer(poly);
    }
  }

  setSunMoon(positions: CelestialPosition[]): void {
    if (!this.map) return;
    this.celestialLayer.clearLayers();

    for (const pos of positions) {
      const emoji = pos.type === 'sun' ? '☀️' : '🌙';
      const label = pos.type === 'sun' ? 'Sun' : 'Moon';

      const icon = L.divIcon({
        className: 'orbitdeck-celestial-marker',
        html: `
          <div style="font-size:18px; transform:translate(-50%, -50%); display:flex; flex-direction:column; align-items:center;" title="${label}">
            <span>${emoji}</span>
          </div>
        `,
        iconSize: [20, 20],
      });

      const marker = L.marker([pos.latitude, pos.longitude], {
        icon,
        interactive: false,
      });
      this.celestialLayer.addLayer(marker);
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
    this.map.flyTo([target.latitude, target.longitude], target.zoom || 4, {
      duration: (target.durationMs || 1000) / 1000,
    });
  }

  followSatellite(satId: number | null): void {
    this.followedSatId = satId;
  }
}
