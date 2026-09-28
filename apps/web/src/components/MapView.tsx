import React, { useEffect, useRef, useState } from 'react';
import type { IMapProvider } from '@orbitdeck/shared';
import { Eye, EyeOff, Locate, Navigation2, RefreshCw } from 'lucide-react';
import * as api from '../api/client.js';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';
import { MAP_PROVIDERS, loadMapProvider } from '../map/providerRegistry.js';

export const MapView: React.FC = () => {
  const {
    mapProviderId,
    tileSource,
    filteredSatellites,
    frames,
    selectedSatId,
    setSelectedSatId,
    followedSatId,
    setFollowedSatId,
    activeStation,
    celestial,
  } = useOrbitDeck();

  const activeNoradIds = React.useMemo(() => {
    return new Set(filteredSatellites.map((s) => s.noradId));
  }, [filteredSatellites]);

  const visibleFrames = React.useMemo(() => {
    return Array.from(frames.values()).filter((f) => activeNoradIds.has(f.noradId));
  }, [frames, activeNoradIds]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<IMapProvider | null>(null);
  const [isLoadingProvider, setIsLoadingProvider] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mount/Switch Provider
  useEffect(() => {
    if (!containerRef.current) return;
    let isCancelled = false;

    setIsLoadingProvider(true);
    setErrorMsg(null);

    // Destroy previous provider
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }

    loadMapProvider(mapProviderId)
      .then(async (provider) => {
        if (isCancelled || !containerRef.current) return;
        providerRef.current = provider;
        const cesiumIonToken =
          typeof localStorage !== 'undefined'
            ? localStorage.getItem('orbitdeck_cesium_token') || undefined
            : undefined;

        await provider.mount(containerRef.current, {
          tileSource,
          cesiumIonToken,
          initialCenter: activeStation
            ? [activeStation.latitude, activeStation.longitude]
            : [20, 0],
          initialZoom: 2,
        });

        // Register callbacks
        provider.onSelectSatellite((satId) => {
          setSelectedSatId(satId);
        });

        provider.onMapClick((_coords) => {
          // Can be used for custom ground point inspection
        });

        // Initial render passes
        provider.setStation(activeStation);
        provider.setSunMoon(celestial);
        provider.setSatellites(visibleFrames);
        setIsLoadingProvider(false);
      })
      .catch((err) => {
        console.error('Failed to load map provider:', err);
        setErrorMsg(`Failed to initialize ${mapProviderId}: ${err.message}`);
        setIsLoadingProvider(false);
      });

    return () => {
      isCancelled = true;
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
    };
  }, [mapProviderId, tileSource]);

  // Update Satellites & Follow Mode (only listed sats on map from the active tab)
  useEffect(() => {
    if (!providerRef.current) return;
    providerRef.current.setSatellites(visibleFrames);
    providerRef.current.followSatellite(followedSatId);
  }, [visibleFrames, followedSatId]);

  // Update Ground Station
  useEffect(() => {
    providerRef.current?.setStation(activeStation);
  }, [activeStation]);

  // Update Celestial Bodies (Sun, Moon)
  useEffect(() => {
    providerRef.current?.setSunMoon(celestial);
  }, [celestial]);

  // Update Ground Track and Footprint when selected satellite changes or updates
  useEffect(() => {
    if (!providerRef.current || !selectedSatId || !activeNoradIds.has(selectedSatId)) {
      providerRef.current?.clearGroundTrack();
      providerRef.current?.clearFootprint();
      return;
    }

    const currentFrame = frames.get(selectedSatId);
    if (currentFrame) {
      providerRef.current.setFootprint(
        selectedSatId,
        { latitude: currentFrame.latitude, longitude: currentFrame.longitude },
        currentFrame.footprintRadiusKm,
      );
    }

    // Fetch ground track
    api
      .fetchGroundTrack(selectedSatId, 0.4, 0.9)
      .then((res) => {
        providerRef.current?.setGroundTrack(selectedSatId, res.points);
      })
      .catch((err) => {
        console.error('Error fetching ground track:', err);
      });
  }, [selectedSatId, frames]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      providerRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const meta = MAP_PROVIDERS[mapProviderId];

  return (
    <div className="relative w-full h-full bg-space-900 overflow-hidden flex flex-col">
      {/* Map Canvas / DOM Container */}
      <div ref={containerRef} className="w-full h-full relative" />

      {/* Loading overlay */}
      {isLoadingProvider && (
        <div className="absolute inset-0 bg-space-900/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="flex flex-col items-center space-y-2">
            <RefreshCw className="w-8 h-8 text-orbit-cyan animate-spin" />
            <span className="text-sm font-bold text-slate-200">
              Loading {meta?.name || mapProviderId}...
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {errorMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orbit-red/90 text-white px-4 py-2 rounded-md shadow-xl text-xs z-30">
          {errorMsg}
        </div>
      )}

      {/* Map Floating Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center space-x-2 bg-space-850/90 backdrop-blur border border-space-700/80 rounded-lg p-1.5 shadow-xl">
        {/* Capability indicator */}
        <div className="px-2 py-1 bg-space-800 rounded text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-orbit-cyan" />
          <span>{meta?.type}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 font-normal">{meta?.name}</span>
        </div>

        {/* Center on QTH */}
        {activeStation && (
          <button
            onClick={() => {
              providerRef.current?.flyTo({
                latitude: activeStation.latitude,
                longitude: activeStation.longitude,
                zoom: 4,
              });
            }}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-space-800 hover:bg-space-700 text-xs text-slate-200 hover:text-orbit-green transition"
            title="Center Map on Ground Station (QTH)"
          >
            <Locate className="w-3.5 h-3.5 text-orbit-green" />
            <span className="hidden sm:inline">QTH</span>
          </button>
        )}

        {/* Follow Satellite */}
        {selectedSatId && (
          <button
            onClick={() => {
              const next = followedSatId === selectedSatId ? null : selectedSatId;
              setFollowedSatId(next);
            }}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition ${
              followedSatId === selectedSatId
                ? 'bg-orbit-cyan text-space-900 font-bold shadow-[0_0_10px_rgba(0,229,255,0.4)]'
                : 'bg-space-800 hover:bg-space-700 text-slate-200 hover:text-orbit-cyan'
            }`}
            title="Lock Camera on Selected Satellite"
          >
            {followedSatId === selectedSatId ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">Follow</span>
          </button>
        )}

        {/* Fly to Satellite */}
        {selectedSatId && frames.has(selectedSatId) && (
          <button
            onClick={() => {
              const frame = frames.get(selectedSatId);
              if (frame) {
                providerRef.current?.flyTo({
                  latitude: frame.latitude,
                  longitude: frame.longitude,
                  zoom: 4,
                });
              }
            }}
            className="p-1 rounded bg-space-800 hover:bg-space-700 text-slate-300 hover:text-orbit-cyan transition"
            title="Fly to Satellite"
          >
            <Navigation2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
