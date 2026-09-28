import React, { useState } from 'react';
import type { MapProviderId } from '@orbitdeck/shared';
import {
  Clock,
  Compass,
  FastForward,
  Globe2,
  Layers,
  MapPin,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useOrbitDeck, type DashboardViewMode } from '../context/OrbitDeckContext.js';
import { MAP_PROVIDERS } from '../map/providerRegistry.js';

interface HeaderProps {
  onOpenStationModal: () => void;
  onOpenMapSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenStationModal, onOpenMapSettings }) => {
  const {
    connected,
    timeState,
    dispatchTimeAction,
    stations,
    activeStation,
    setActiveStationId,
    refreshTLEData,
    isRefreshingTLE,
    mapProviderId,
    setMapProviderId,
    viewMode,
    setViewMode,
  } = useOrbitDeck();

  const [isSpeedOpen, setIsSpeedOpen] = useState(false);

  const speedMultipliers = [1, 2, 5, 10, 60, 300];

  const formattedUtc = new Date(timeState.timestamp).toUTCString().replace('GMT', 'UTC');

  return (
    <header className="h-14 bg-space-850 border-b border-space-700 px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Brand & Station Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-space-800 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]">
            <Compass className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-sm tracking-wider text-slate-100">
                ORBIT<span className="text-orbit-cyan">DECK</span>
              </span>
              <span className="text-[9px] bg-space-700 text-orbit-cyan px-1.5 py-0.5 rounded font-bold">
                v0.5
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-slate-400">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  connected ? 'bg-orbit-green shadow-[0_0_6px_#00e676]' : 'bg-orbit-red'
                }`}
              />
              <span>{connected ? 'LIVE TELEMETRY' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>

        {/* QTH Station Selector */}
        <div className="flex items-center bg-space-800 border border-space-700 rounded-md px-2 py-1 text-xs">
          <MapPin className="w-3.5 h-3.5 text-orbit-green mr-1.5" />
          <select
            value={activeStation?.id || ''}
            onChange={(e) => {
              if (e.target.value === '__add__') {
                onOpenStationModal();
              } else {
                setActiveStationId(e.target.value);
              }
            }}
            className="bg-transparent text-slate-200 outline-none cursor-pointer pr-1"
          >
            {stations.map((st) => (
              <option key={st.id} value={st.id} className="bg-space-800 text-slate-200">
                {st.name} ({st.maidenhead})
              </option>
            ))}
            <option value="__add__" className="bg-space-800 text-orbit-cyan font-bold">
              + Manage Stations...
            </option>
          </select>
        </div>
      </div>

      {/* Center: Time Controller */}
      <div className="flex items-center space-x-2 bg-space-800/90 border border-space-700 rounded-lg px-3 py-1 shadow-inner">
        <Clock className="w-4 h-4 text-orbit-cyan" />
        <span className="text-xs font-mono font-semibold text-slate-200 min-w-[200px] text-center">
          {formattedUtc}
        </span>

        {/* Pause / Play */}
        <button
          onClick={() =>
            dispatchTimeAction({
              type: timeState.isPaused ? 'RESUME' : 'PAUSE',
            })
          }
          className={`p-1 rounded hover:bg-space-700 text-xs transition ${
            timeState.isPaused ? 'text-orbit-amber' : 'text-orbit-green'
          }`}
          title={timeState.isPaused ? 'Resume Clock' : 'Pause Clock'}
        >
          {timeState.isPaused ? (
            <Play className="w-3.5 h-3.5" />
          ) : (
            <Pause className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Speed Multiplier */}
        <div className="relative">
          <button
            onClick={() => setIsSpeedOpen(!isSpeedOpen)}
            className="flex items-center space-x-1 text-xs px-2 py-0.5 rounded bg-space-700 text-slate-200 hover:bg-space-600 transition"
            title="Simulation Speed Multiplier"
          >
            <FastForward className="w-3 h-3 text-orbit-cyan" />
            <span className="font-bold">{timeState.speedMultiplier}x</span>
          </button>

          {isSpeedOpen && (
            <div className="absolute top-8 left-0 bg-space-800 border border-space-700 rounded-md shadow-xl py-1 z-50 min-w-[70px]">
              {speedMultipliers.map((mult) => (
                <button
                  key={mult}
                  onClick={() => {
                    dispatchTimeAction({ type: 'SET_SPEED', payload: mult });
                    setIsSpeedOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-xs hover:bg-space-700 ${
                    timeState.speedMultiplier === mult
                      ? 'text-orbit-cyan font-bold bg-space-700/50'
                      : 'text-slate-300'
                  }`}
                >
                  {mult}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset to Real-time */}
        <button
          onClick={() => dispatchTimeAction({ type: 'RESET_TO_NOW' })}
          className="text-xs text-slate-400 hover:text-orbit-cyan p-1 hover:bg-space-700 rounded transition"
          title="Reset to Real-time Now"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: View Layout Tabs & Map Provider Toggle */}
      <div className="flex items-center space-x-3">
        {/* View Switcher Tabs */}
        <div className="flex items-center bg-space-800 border border-space-700 rounded-lg p-0.5 text-xs">
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'map', label: 'Map' },
              { id: 'polar', label: 'Polar Plot' },
              { id: 'details', label: 'Telemetry' },
              { id: 'passes', label: 'Passes' },
              { id: 'radio', label: 'Radio' },
            ] as { id: DashboardViewMode; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 rounded-md transition font-medium ${
                viewMode === tab.id
                  ? 'bg-space-700 text-orbit-cyan font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Map Provider Selector */}
        <div className="flex items-center bg-space-800 border border-space-700 rounded-md px-2 py-1 text-xs">
          <Globe2 className="w-3.5 h-3.5 text-orbit-cyan mr-1.5" />
          <select
            value={mapProviderId}
            onChange={(e) => setMapProviderId(e.target.value as MapProviderId)}
            className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
            title="Switch Map Engine (Runtime, no reload)"
          >
            {Object.values(MAP_PROVIDERS).map((p) => (
              <option key={p.id} value={p.id} className="bg-space-800 text-slate-200">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Map Settings / Tile Source Modal Trigger */}
        <button
          onClick={onOpenMapSettings}
          className="p-1.5 rounded-md bg-space-800 border border-space-700 text-slate-300 hover:text-orbit-cyan hover:bg-space-700 transition"
          title="Map Layer & Tile Settings"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* TLE Refresh Button */}
        <button
          onClick={refreshTLEData}
          disabled={isRefreshingTLE}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-space-800 border border-space-700 text-slate-200 hover:text-orbit-cyan hover:bg-space-700 text-xs transition disabled:opacity-50"
          title="Refresh TLE from CelesTrak"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshingTLE ? 'animate-spin text-orbit-cyan' : ''}`}
          />
          <span className="hidden md:inline">TLE</span>
        </button>
      </div>
    </header>
  );
};
