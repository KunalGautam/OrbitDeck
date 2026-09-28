import React, { useState } from 'react';
import type { MapProviderId } from '@orbitdeck/shared';
import {
  Activity,
  Calendar,
  Clock,
  Compass,
  Database,
  FastForward,
  Globe2,
  Layers,
  LayoutDashboard,
  MapPin,
  Menu,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  X,
} from 'lucide-react';
import { useOrbitDeck, type DashboardViewMode } from '../context/OrbitDeckContext.js';
import { MAP_PROVIDERS } from '../map/providerRegistry.js';

interface HeaderProps {
  onOpenStationModal: () => void;
  onOpenMapSettings: () => void;
  onOpenTLEModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenStationModal,
  onOpenMapSettings,
  onOpenTLEModal,
}) => {
  const {
    connected,
    timeState,
    dispatchTimeAction,
    stations,
    activeStation,
    setActiveStationId,
    refreshTLEData,
    isRefreshingTLE,
    tleProgress,
    mapProviderId,
    setMapProviderId,
    viewMode,
    setViewMode,
  } = useOrbitDeck();

  const [isSpeedOpen, setIsSpeedOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const speedMultipliers = [1, 2, 5, 10, 60, 300];

  const date = new Date(timeState.timestamp);
  const formattedUtc = date.toUTCString().replace('GMT', 'UTC');
  const compactUtc = date.toISOString().slice(11, 19) + ' UTC';

  const viewTabs: {
    id: DashboardViewMode;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Map', icon: Globe2 },
    { id: 'polar', label: 'Polar Plot', icon: Compass },
    { id: 'details', label: 'Telemetry', icon: Activity },
    { id: 'passes', label: 'Passes', icon: Calendar },
    { id: 'radio', label: 'Radio', icon: Radio },
  ];

  return (
    <>
      <header className="h-14 bg-space-850 border-b border-space-700 px-3 sm:px-4 flex items-center justify-between z-30 select-none relative">
        {/* Left: Brand & Station Selector */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-space-800 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)] flex-shrink-0">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xs sm:text-sm tracking-wider text-slate-100">
                  ORBIT<span className="text-orbit-cyan">DECK</span>
                </span>
                <span className="text-[9px] bg-space-700 text-orbit-cyan px-1.5 py-0.5 rounded font-bold hidden sm:inline">
                  v0.5
                </span>
              </div>
              <div className="flex items-center space-x-1 text-[9px] sm:text-[10px] text-slate-400">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    connected ? 'bg-orbit-green shadow-[0_0_6px_#00e676]' : 'bg-orbit-red'
                  }`}
                />
                <span className="truncate max-w-[70px] sm:max-w-none">
                  {connected ? 'LIVE' : 'OFFLINE'}
                </span>
              </div>
            </div>
          </div>

          {/* QTH Station Selector (Visible on sm+ screens) */}
          <div className="hidden sm:flex items-center bg-space-800 border border-space-700 rounded-md px-2 py-1 text-xs max-w-[170px] md:max-w-[210px]">
            <MapPin className="w-3.5 h-3.5 text-orbit-green mr-1.5 flex-shrink-0" />
            <select
              value={activeStation?.id || ''}
              onChange={(e) => {
                if (e.target.value === '__add__') {
                  onOpenStationModal();
                } else {
                  setActiveStationId(e.target.value);
                }
              }}
              className="bg-transparent text-slate-200 outline-none cursor-pointer pr-1 truncate text-xs w-full"
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

        {/* Center: Time Controller (Hidden on <md, compact on md-xl, full on xl+) */}
        <div className="hidden md:flex items-center space-x-2 bg-space-800/90 border border-space-700 rounded-lg px-2.5 py-1 shadow-inner">
          <Clock className="w-3.5 h-3.5 text-orbit-cyan flex-shrink-0" />
          <span className="text-xs font-mono font-semibold text-slate-200 text-center whitespace-nowrap">
            <span className="hidden xl:inline">{formattedUtc}</span>
            <span className="xl:hidden">{compactUtc}</span>
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
              className="flex items-center space-x-1 text-xs px-1.5 py-0.5 rounded bg-space-700 text-slate-200 hover:bg-space-600 transition"
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

        {/* Right: View Switcher, Provider, Settings, TLE & Mobile Toggle */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {/* View Switcher Tabs (Desktop lg+ screens) */}
          <div className="hidden lg:flex items-center bg-space-800 border border-space-700 rounded-lg p-0.5 text-xs">
            {viewTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setViewMode(tab.id)}
                  className={`px-2 py-1 rounded-md transition font-medium flex items-center space-x-1 ${
                    viewMode === tab.id
                      ? 'bg-space-700 text-orbit-cyan font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Map Provider Selector (Desktop xl+ screens) */}
          <div className="hidden xl:flex items-center bg-space-800 border border-space-700 rounded-md px-2 py-1 text-xs">
            <Globe2 className="w-3.5 h-3.5 text-orbit-cyan mr-1.5 flex-shrink-0" />
            <select
              value={mapProviderId}
              onChange={(e) => setMapProviderId(e.target.value as MapProviderId)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs"
              title="Switch Map Engine"
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

          {/* TLE Control: Refresh & Sources Manager */}
          <div className="flex items-center">
            <button
              onClick={refreshTLEData}
              disabled={isRefreshingTLE}
              className="flex items-center space-x-1 px-2 py-1 rounded-l-md bg-space-800 border border-space-700 text-slate-200 hover:text-orbit-cyan hover:bg-space-700 text-xs transition disabled:opacity-50"
              title="Refresh TLE from all feeds"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshingTLE ? 'animate-spin text-orbit-cyan' : ''}`}
              />
              <span className="hidden sm:inline">TLE</span>
            </button>
            <button
              onClick={onOpenTLEModal}
              className="p-1 rounded-r-md bg-space-800 border-y border-r border-space-700 text-slate-300 hover:text-orbit-cyan hover:bg-space-700 transition"
              title="Manage TLE Sources & Offline Storage"
            >
              <Database className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Menu Toggle Button (Visible on <lg screens) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-1.5 rounded-md bg-space-800 border border-space-700 text-slate-300 hover:text-orbit-cyan hover:bg-space-700 transition"
            title="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer (Accordion navigation on screens < lg) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-space-850 border-b border-space-700 p-3 space-y-3 z-30 shadow-2xl animate-in slide-in-from-top-2 duration-150 text-xs">
          {/* View Mode Switcher Buttons */}
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Views
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {viewTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setViewMode(tab.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`p-2 rounded-lg transition font-medium flex flex-col items-center justify-center space-y-1 text-center border ${
                      viewMode === tab.id
                        ? 'bg-space-750 border-orbit-cyan text-orbit-cyan font-bold shadow'
                        : 'bg-space-800 border-space-700 text-slate-300 hover:bg-space-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px]">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ground Station Selector (Mobile View) */}
          <div className="sm:hidden space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Ground Station (QTH)
            </div>
            <div className="flex items-center bg-space-800 border border-space-700 rounded-md px-2 py-1.5">
              <MapPin className="w-3.5 h-3.5 text-orbit-green mr-1.5 flex-shrink-0" />
              <select
                value={activeStation?.id || ''}
                onChange={(e) => {
                  if (e.target.value === '__add__') {
                    onOpenStationModal();
                    setIsMobileMenuOpen(false);
                  } else {
                    setActiveStationId(e.target.value);
                  }
                }}
                className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs w-full"
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

          {/* Time Controller & Simulation (Mobile View) */}
          <div className="md:hidden bg-space-900 border border-space-700 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-orbit-cyan" />
                <span className="font-mono text-xs font-semibold">{compactUtc}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() =>
                    dispatchTimeAction({
                      type: timeState.isPaused ? 'RESUME' : 'PAUSE',
                    })
                  }
                  className={`p-1 rounded hover:bg-space-750 transition ${
                    timeState.isPaused ? 'text-orbit-amber' : 'text-orbit-green'
                  }`}
                  title={timeState.isPaused ? 'Resume' : 'Pause'}
                >
                  {timeState.isPaused ? (
                    <Play className="w-4 h-4" />
                  ) : (
                    <Pause className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => dispatchTimeAction({ type: 'RESET_TO_NOW' })}
                  className="p-1 rounded text-slate-400 hover:text-orbit-cyan hover:bg-space-750 transition"
                  title="Reset to Real-time"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center space-x-1 pt-1 overflow-x-auto">
              <span className="text-[10px] text-slate-400 mr-1 flex-shrink-0">Speed:</span>
              {speedMultipliers.map((mult) => (
                <button
                  key={mult}
                  onClick={() => dispatchTimeAction({ type: 'SET_SPEED', payload: mult })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                    timeState.speedMultiplier === mult
                      ? 'bg-orbit-cyan text-space-950 font-bold'
                      : 'bg-space-800 text-slate-300 hover:bg-space-750'
                  }`}
                >
                  {mult}x
                </button>
              ))}
            </div>
          </div>

          {/* Map Engine Selection (Tablet / Mobile View) */}
          <div className="xl:hidden flex items-center justify-between bg-space-800 border border-space-700 rounded-md px-2.5 py-1.5">
            <span className="text-slate-400 flex items-center space-x-1.5">
              <Globe2 className="w-3.5 h-3.5 text-orbit-cyan" />
              <span>Map Provider:</span>
            </span>
            <select
              value={mapProviderId}
              onChange={(e) => setMapProviderId(e.target.value as MapProviderId)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer text-xs font-semibold"
            >
              {Object.values(MAP_PROVIDERS).map((p) => (
                <option key={p.id} value={p.id} className="bg-space-800 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Live TLE Download & Update Progress Banner */}
      {(isRefreshingTLE || Boolean(tleProgress?.isRefreshing)) && (
        <div className="bg-space-900 border-b border-orbit-cyan/40 px-3 sm:px-4 py-1.5 flex items-center justify-between text-xs z-20 shadow-md">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 max-w-2xl mr-2 sm:mr-4">
            <RefreshCw className="w-3.5 h-3.5 text-orbit-cyan animate-spin flex-shrink-0" />
            <span className="text-slate-300 font-mono text-[10px] sm:text-[11px] truncate">
              {tleProgress?.message || 'Updating TLE catalogue...'}
            </span>
            <div className="flex-1 bg-space-800 rounded-full h-2 overflow-hidden border border-space-700 min-w-[70px] sm:min-w-[100px]">
              <div
                className="bg-gradient-to-r from-orbit-cyan via-teal-400 to-orbit-green h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${Math.max(5, Math.min(100, Math.round(tleProgress?.percent ?? 0)))}%`,
                }}
              />
            </div>
            <span className="text-orbit-cyan font-mono font-bold text-[10px] sm:text-[11px]">
              {Math.round(tleProgress?.percent ?? 0)}%
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] sm:text-[11px] text-slate-400 flex-shrink-0">
            {tleProgress?.completedSources !== undefined &&
              tleProgress?.totalSources !== undefined && (
                <span className="hidden sm:inline">
                  {tleProgress.completedSources}/{tleProgress.totalSources}
                </span>
              )}
            <button
              onClick={onOpenTLEModal}
              className="text-orbit-cyan hover:underline text-[10px] sm:text-[11px] font-semibold"
            >
              Details
            </button>
          </div>
        </div>
      )}
    </>
  );
};
