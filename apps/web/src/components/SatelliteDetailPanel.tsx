import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Compass,
  Copy,
  Crosshair,
  Gauge,
  Globe,
  Radio,
  Star,
  Sun,
  Moon,
  Zap,
} from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

export const SatelliteDetailPanel: React.FC = () => {
  const {
    selectedSatellite,
    selectedFrame,
    followedSatId,
    setFollowedSatId,
    toggleSatFavorite,
    activeStation,
  } = useOrbitDeck();

  const [showTle, setShowTle] = useState(false);
  const [copiedTle, setCopiedTle] = useState(false);

  if (!selectedSatellite) {
    return (
      <div className="h-full bg-space-850 border border-space-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
        <Activity className="w-10 h-10 mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">Select a satellite to view telemetry</p>
      </div>
    );
  }

  const isFollowed = followedSatId === selectedSatellite.noradId;
  const isFavorite = !!selectedSatellite.isFavorite;

  const handleCopyTle = () => {
    const text = `${selectedSatellite.name}\n${selectedSatellite.line1}\n${selectedSatellite.line2}`;
    navigator.clipboard.writeText(text);
    setCopiedTle(true);
    setTimeout(() => setCopiedTle(false), 2000);
  };

  const formatLat = (lat: number) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const formatLon = (lon: number) => `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;

  // Compass cardinal direction
  const getCardinal = (deg: number) => {
    const directions = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const idx = Math.round(deg / 22.5) % 16;
    return directions[idx];
  };

  const isVisibleAtStation =
    selectedFrame?.elevationDeg !== undefined && selectedFrame.elevationDeg > 0;

  return (
    <div className="h-full bg-space-850 border border-space-700 rounded-lg flex flex-col overflow-hidden select-none">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-space-800 border-b border-space-700 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-space-900 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-slate-100 text-sm tracking-wide">
                {selectedSatellite.name}
              </h2>
              {selectedSatellite.isStale && (
                <span className="flex items-center space-x-1 text-[10px] bg-orbit-red/20 text-orbit-red border border-orbit-red/40 px-1.5 py-0.5 rounded font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  <span>STALE TLE</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2">
              <span>NORAD #{selectedSatellite.noradId}</span>
              {selectedSatellite.intlDes && (
                <>
                  <span>•</span>
                  <span>{selectedSatellite.intlDes}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          {/* Follow Button */}
          <button
            onClick={() => setFollowedSatId(isFollowed ? null : selectedSatellite.noradId)}
            className={`p-1.5 rounded border transition flex items-center space-x-1 text-xs ${
              isFollowed
                ? 'bg-orbit-cyan/20 border-orbit-cyan text-orbit-cyan shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                : 'bg-space-700/60 border-space-600 text-slate-300 hover:text-white hover:bg-space-600'
            }`}
            title={isFollowed ? 'Unfollow satellite' : 'Follow on map'}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">
              {isFollowed ? 'Tracking' : 'Follow'}
            </span>
          </button>

          {/* Favorite Button */}
          <button
            onClick={() => toggleSatFavorite(selectedSatellite.noradId)}
            className={`p-1.5 rounded border transition ${
              isFavorite
                ? 'bg-orbit-amber/20 border-orbit-amber text-orbit-amber'
                : 'bg-space-700/60 border-space-600 text-slate-400 hover:text-orbit-amber hover:bg-space-600'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-orbit-amber' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
        {/* Groups */}
        <div className="flex flex-wrap gap-1">
          {selectedSatellite.groups.map((grp) => (
            <span
              key={grp}
              className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-space-800 text-slate-300 border border-space-700"
            >
              {grp}
            </span>
          ))}
          {/* Eclipse Indicator */}
          {selectedFrame && (
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border flex items-center space-x-1 ${
                selectedFrame.eclipseStatus === 'sunlit'
                  ? 'bg-orbit-amber/15 text-orbit-amber border-orbit-amber/30'
                  : selectedFrame.eclipseStatus === 'penumbra'
                    ? 'bg-orbit-cyan/15 text-orbit-cyan border-orbit-cyan/30'
                    : 'bg-space-700/80 text-slate-400 border-space-600'
              }`}
            >
              {selectedFrame.eclipseStatus === 'sunlit' ? (
                <Sun className="w-3 h-3 text-orbit-amber" />
              ) : (
                <Moon className="w-3 h-3" />
              )}
              <span>{selectedFrame.eclipseStatus}</span>
            </span>
          )}
        </div>

        {/* Live Sub-Satellite Point & Altitude */}
        <div className="bg-space-800/80 border border-space-700 rounded-lg p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Globe className="w-3.5 h-3.5 text-orbit-cyan" />
            <span>Sub-Satellite Coordinates (WGS-84)</span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Latitude</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame ? formatLat(selectedFrame.latitude) : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Longitude</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame ? formatLon(selectedFrame.longitude) : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Altitude</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame ? `${selectedFrame.altitudeKm.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Orbital Velocity</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame ? `${selectedFrame.velocityKmS.toFixed(2)} km/s` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Ground Station Relative Telemetry (QTH) */}
        <div className="bg-space-800/80 border border-space-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Compass className="w-3.5 h-3.5 text-orbit-green" />
              <span>Relative to QTH ({activeStation?.name || 'No Station'})</span>
            </div>
            {selectedFrame?.elevationDeg !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  isVisibleAtStation
                    ? 'bg-orbit-green/20 text-orbit-green border border-orbit-green/40'
                    : 'bg-space-700 text-slate-400'
                }`}
              >
                {isVisibleAtStation ? 'IN VIEW (AOS)' : 'BELOW HORIZON (LOS)'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Azimuth</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame?.azimuthDeg !== undefined
                  ? `${selectedFrame.azimuthDeg.toFixed(1)}° (${getCardinal(selectedFrame.azimuthDeg)})`
                  : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Elevation</span>
              <span
                className={`font-semibold text-sm ${
                  isVisibleAtStation ? 'text-orbit-green font-bold' : 'text-slate-100'
                }`}
              >
                {selectedFrame?.elevationDeg !== undefined
                  ? `${selectedFrame.elevationDeg.toFixed(1)}°`
                  : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Slant Range</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame?.rangeKm !== undefined
                  ? `${Math.round(selectedFrame.rangeKm).toLocaleString()} km`
                  : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Range Rate</span>
              <span
                className={`font-semibold text-sm ${
                  (selectedFrame?.rangeRateKmS ?? 0) < 0 ? 'text-orbit-green' : 'text-orbit-amber'
                }`}
              >
                {selectedFrame?.rangeRateKmS !== undefined
                  ? `${selectedFrame.rangeRateKmS > 0 ? '+' : ''}${selectedFrame.rangeRateKmS.toFixed(2)} km/s`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Footprint & Coverage */}
        <div className="bg-space-800/80 border border-space-700 rounded-lg p-3 space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Gauge className="w-3.5 h-3.5 text-orbit-cyan" />
            <span>Coverage & Footprint</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Footprint Radius</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame
                  ? `${Math.round(selectedFrame.footprintRadiusKm).toLocaleString()} km`
                  : '—'}
              </span>
            </div>
            <div className="bg-space-900/60 p-2 rounded border border-space-750">
              <span className="text-[10px] text-slate-400 block">Footprint Diameter</span>
              <span className="text-slate-100 font-semibold text-sm">
                {selectedFrame
                  ? `${Math.round(selectedFrame.footprintRadiusKm * 2).toLocaleString()} km`
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* TLE Raw Data Drawer */}
        <div className="border border-space-700 rounded-lg overflow-hidden bg-space-800/50">
          <button
            onClick={() => setShowTle(!showTle)}
            className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-space-750 transition text-slate-300"
          >
            <span className="text-xs font-semibold flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-orbit-amber" />
              <span>Two-Line Element Set (TLE)</span>
            </span>
            {showTle ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {showTle && (
            <div className="p-3 bg-space-900 border-t border-space-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  Updated: {new Date(selectedSatellite.updatedAt).toLocaleString()}
                </span>
                <button
                  onClick={handleCopyTle}
                  className="flex items-center space-x-1 text-[11px] text-orbit-cyan hover:underline"
                >
                  {copiedTle ? (
                    <>
                      <Check className="w-3 h-3 text-orbit-green" />
                      <span className="text-orbit-green">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy TLE</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[10px] font-mono bg-space-950 p-2 rounded border border-space-750 text-slate-300 overflow-x-auto select-all leading-relaxed">
                {selectedSatellite.name}
                {selectedSatellite.line1}
                {selectedSatellite.line2}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
