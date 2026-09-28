import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type {
  CelestialPosition,
  CreateGroundStationInput,
  GroundStation,
  LiveTrackingFrame,
  MapProviderId,
  MapTileSource,
  PassPrediction,
  Satellite,
  SatelliteGroup,
  TimeControlAction,
  TimeControlState,
  UpdateGroundStationInput,
} from '@orbitdeck/shared';
import * as api from '../api/client.js';
import { getInitialMapProviderId, saveMapProviderPreference } from '../map/providerRegistry.js';
import { DEFAULT_TILE_SOURCES } from '../map/tileSources.js';

export type DashboardViewMode = 'dashboard' | 'map' | 'polar' | 'details' | 'passes' | 'radio';

interface OrbitDeckContextType {
  // Satellites
  satellites: (Satellite & { isStale: boolean })[];
  selectedSatId: number | null;
  selectedSatellite: (Satellite & { isStale: boolean }) | null;
  selectedFrame: LiveTrackingFrame | null;
  followedSatId: number | null;
  setSelectedSatId: (id: number | null) => void;
  setFollowedSatId: (id: number | null) => void;
  toggleSatFavorite: (noradId: number) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedGroup: SatelliteGroup | 'all' | 'favorites';
  setSelectedGroup: (grp: SatelliteGroup | 'all' | 'favorites') => void;
  refreshTLEData: () => Promise<void>;
  isRefreshingTLE: boolean;

  // Stations (QTH)
  stations: GroundStation[];
  activeStation: GroundStation | null;
  setActiveStationId: (id: string) => void;
  addStation: (input: CreateGroundStationInput) => Promise<GroundStation>;
  editStation: (id: string, input: UpdateGroundStationInput) => Promise<void>;
  removeStation: (id: string) => Promise<void>;

  // Real-time tracking
  frames: Map<number, LiveTrackingFrame>;
  celestial: CelestialPosition[];
  connected: boolean;

  // Time Controller
  timeState: TimeControlState;
  dispatchTimeAction: (action: TimeControlAction) => Promise<void>;

  // Map settings
  mapProviderId: MapProviderId;
  setMapProviderId: (id: MapProviderId) => void;
  tileSource: MapTileSource;
  setTileSource: (source: MapTileSource) => void;

  // View mode
  viewMode: DashboardViewMode;
  setViewMode: (mode: DashboardViewMode) => void;

  // Pass Predictions
  activePasses: PassPrediction[];
  isLoadingPasses: boolean;
  minElevationFilter: number;
  setMinElevationFilter: (el: number) => void;
}

const OrbitDeckContext = createContext<OrbitDeckContextType | null>(null);

export const OrbitDeckProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Satellites
  const [satellites, setSatellites] = useState<(Satellite & { isStale: boolean })[]>([]);
  const [selectedSatId, setSelectedSatId] = useState<number | null>(25544); // ISS default
  const [followedSatId, setFollowedSatId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<SatelliteGroup | 'all' | 'favorites'>('all');
  const [isRefreshingTLE, setIsRefreshingTLE] = useState(false);

  // Stations
  const [stations, setStations] = useState<GroundStation[]>([]);
  const [activeStationId, setActiveStationId] = useState<string | null>(null);

  // Tracking
  const [frames, setFrames] = useState<Map<number, LiveTrackingFrame>>(new Map());
  const [celestial, setCelestial] = useState<CelestialPosition[]>([]);
  const [connected, setConnected] = useState(false);

  // Time
  const [timeState, setTimeState] = useState<TimeControlState>({
    mode: 'realtime',
    isPaused: false,
    speedMultiplier: 1.0,
    timestamp: Date.now(),
    lastWallClockSync: Date.now(),
  });

  // Map
  const [mapProviderId, setMapProviderIdState] = useState<MapProviderId>(getInitialMapProviderId);
  const [tileSource, setTileSource] = useState<MapTileSource>(DEFAULT_TILE_SOURCES[0]!);

  // View
  const [viewMode, setViewMode] = useState<DashboardViewMode>('dashboard');

  // Passes
  const [activePasses, setActivePasses] = useState<PassPrediction[]>([]);
  const [isLoadingPasses, setIsLoadingPasses] = useState(false);
  const [minElevationFilter, setMinElevationFilter] = useState(10);

  const wsRef = useRef<WebSocket | null>(null);

  const setMapProviderId = useCallback((id: MapProviderId) => {
    setMapProviderIdState(id);
    saveMapProviderPreference(id);
  }, []);

  // Fetch initial stations and satellites
  const loadInitialData = useCallback(async () => {
    try {
      const [stationList, satResult] = await Promise.all([
        api.fetchStations(),
        api.fetchSatellites({ limit: 100 }),
      ]);
      setStations(stationList);
      if (stationList.length > 0) {
        const def = stationList.find((s) => s.isDefault) || stationList[0]!;
        setActiveStationId(def.id);
      }
      setSatellites(satResult.satellites);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Connect WebSocket
  useEffect(() => {
    if (typeof WebSocket === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (activeStationId) {
        ws.send(JSON.stringify({ type: 'SET_STATION', stationId: activeStationId }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TRACKING_UPDATE') {
          if (Array.isArray(msg.frames)) {
            setFrames((prev) => {
              const updated = new Map(prev);
              for (const f of msg.frames as LiveTrackingFrame[]) {
                updated.set(f.noradId, f);
              }
              return updated;
            });
          }
          if (Array.isArray(msg.celestial)) {
            setCelestial(msg.celestial);
          }
          if (msg.timeState) {
            setTimeState(msg.timeState);
          }
        } else if (msg.type === 'CONNECTED' || msg.type === 'TIME_STATE_CHANGED') {
          if (msg.timeState) {
            setTimeState(msg.timeState);
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [activeStationId]);

  // Sync active station with WebSocket
  useEffect(() => {
    if (
      typeof WebSocket !== 'undefined' &&
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN &&
      activeStationId
    ) {
      wsRef.current.send(JSON.stringify({ type: 'SET_STATION', stationId: activeStationId }));
    }
  }, [activeStationId]);

  // Fetch passes when selected satellite or station changes
  const activeStation = stations.find((s) => s.id === activeStationId) || stations[0] || null;

  useEffect(() => {
    if (!selectedSatId || !activeStation) {
      setActivePasses([]);
      return;
    }

    let isMounted = true;
    setIsLoadingPasses(true);

    api
      .fetchPasses({
        noradId: selectedSatId,
        stationId: activeStation.id,
        daysAhead: 3,
        minElevationDeg: minElevationFilter,
      })
      .then((res) => {
        if (isMounted) {
          setActivePasses(res.passes);
          setIsLoadingPasses(false);
        }
      })
      .catch((err) => {
        console.error('Error fetching passes:', err);
        if (isMounted) setIsLoadingPasses(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSatId, activeStation, minElevationFilter]);

  const toggleSatFavorite = async (noradId: number) => {
    const target = satellites.find((s) => s.noradId === noradId);
    if (!target) return;
    const newFav = !target.isFavorite;

    await api.toggleFavorite(noradId, newFav);
    setSatellites((prev) =>
      prev.map((s) => (s.noradId === noradId ? { ...s, isFavorite: newFav } : s)),
    );
  };

  const refreshTLEData = async () => {
    setIsRefreshingTLE(true);
    try {
      await api.refreshTLE();
      const res = await api.fetchSatellites({ limit: 100 });
      setSatellites(res.satellites);
    } finally {
      setIsRefreshingTLE(false);
    }
  };

  const addStation = async (input: CreateGroundStationInput): Promise<GroundStation> => {
    const created = await api.createStation(input);
    const updatedList = await api.fetchStations();
    setStations(updatedList);
    setActiveStationId(created.id);
    return created;
  };

  const editStation = async (id: string, input: UpdateGroundStationInput): Promise<void> => {
    await api.updateStation(id, input);
    const updatedList = await api.fetchStations();
    setStations(updatedList);
  };

  const removeStation = async (id: string): Promise<void> => {
    await api.deleteStation(id);
    const updatedList = await api.fetchStations();
    setStations(updatedList);
    if (activeStationId === id && updatedList.length > 0) {
      setActiveStationId(updatedList[0]!.id);
    }
  };

  const dispatchTimeAction = async (action: TimeControlAction): Promise<void> => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'TIME_CONTROL', action }));
    } else {
      const updated = await api.sendTimeAction(action);
      setTimeState(updated);
    }
  };

  const selectedSatellite = satellites.find((s) => s.noradId === selectedSatId) || null;
  const selectedFrame = selectedSatId ? frames.get(selectedSatId) || null : null;

  return (
    <OrbitDeckContext.Provider
      value={{
        satellites,
        selectedSatId,
        selectedSatellite,
        selectedFrame,
        followedSatId,
        setSelectedSatId,
        setFollowedSatId,
        toggleSatFavorite,
        searchQuery,
        setSearchQuery,
        selectedGroup,
        setSelectedGroup,
        refreshTLEData,
        isRefreshingTLE,
        stations,
        activeStation,
        setActiveStationId,
        addStation,
        editStation,
        removeStation,
        frames,
        celestial,
        connected,
        timeState,
        dispatchTimeAction,
        mapProviderId,
        setMapProviderId,
        tileSource,
        setTileSource,
        viewMode,
        setViewMode,
        activePasses,
        isLoadingPasses,
        minElevationFilter,
        setMinElevationFilter,
      }}
    >
      {children}
    </OrbitDeckContext.Provider>
  );
};

export const useOrbitDeck = (): OrbitDeckContextType => {
  const context = useContext(OrbitDeckContext);
  if (!context) {
    throw new Error('useOrbitDeck must be used within OrbitDeckProvider');
  }
  return context;
};
