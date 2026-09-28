import React, { useState } from 'react';
import type { PassVisibility } from '@orbitdeck/shared';
import {
  Calendar,
  Clock,
  Compass,
  Eye,
  FileSpreadsheet,
  Moon,
  Play,
  Sun,
  Sunrise,
} from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

export const PassPredictionPanel: React.FC = () => {
  const {
    selectedSatellite,
    activeStation,
    activePasses,
    isLoadingPasses,
    minElevationFilter,
    setMinElevationFilter,
    dispatchTimeAction,
    timeState,
  } = useOrbitDeck();

  const [daysAhead, setDaysAhead] = useState(3);

  if (!selectedSatellite) {
    return (
      <div className="h-full bg-space-850 border border-space-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
        <Calendar className="w-10 h-10 mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">Select a satellite to view upcoming passes</p>
      </div>
    );
  }

  if (!activeStation) {
    return (
      <div className="h-full bg-space-850 border border-space-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
        <Compass className="w-10 h-10 mb-2 text-slate-600" />
        <p className="text-sm">Please configure a ground station (QTH) first</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const getVisibilityBadge = (vis: PassVisibility) => {
    switch (vis) {
      case 'visible':
        return (
          <span className="flex items-center space-x-1 text-[10px] bg-orbit-green/20 text-orbit-green border border-orbit-green/40 px-2 py-0.5 rounded font-bold">
            <Eye className="w-3 h-3" />
            <span>VISIBLE</span>
          </span>
        );
      case 'daylight':
        return (
          <span className="flex items-center space-x-1 text-[10px] bg-orbit-amber/20 text-orbit-amber border border-orbit-amber/40 px-2 py-0.5 rounded font-bold">
            <Sun className="w-3 h-3" />
            <span>DAYLIGHT</span>
          </span>
        );
      case 'eclipsed':
      default:
        return (
          <span className="flex items-center space-x-1 text-[10px] bg-space-700 text-slate-400 border border-space-600 px-2 py-0.5 rounded font-medium">
            <Moon className="w-3 h-3" />
            <span>ECLIPSED</span>
          </span>
        );
    }
  };

  const now = timeState.timestamp;
  const currentPass = activePasses.find((p) => p.aosTime <= now && p.losTime >= now);
  const nextPass = activePasses.find((p) => p.aosTime > now);

  const getElevationColor = (el: number) => {
    if (el >= 50) return 'text-orbit-green font-bold';
    if (el >= 25) return 'text-orbit-cyan font-bold';
    return 'text-slate-300';
  };

  const exportUrl = (format: 'ics' | 'csv') => {
    return `/api/passes/export?noradId=${selectedSatellite.noradId}&stationId=${activeStation.id}&daysAhead=${daysAhead}&minElevationDeg=${minElevationFilter}&format=${format}`;
  };

  return (
    <div className="h-full bg-space-850 border border-space-700 rounded-lg flex flex-col overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-3 bg-space-800 border-b border-space-700 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-orbit-cyan" />
              <span>Pass Predictions: {selectedSatellite.name}</span>
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Ground Station: {activeStation.name} ({activeStation.maidenhead})
            </p>
          </div>

          {/* Export Buttons */}
          <div className="flex items-center space-x-2">
            <a
              href={exportUrl('ics')}
              download
              className="flex items-center space-x-1 px-2.5 py-1 bg-space-700/80 hover:bg-space-600 border border-space-600 rounded text-xs text-slate-200 transition"
              title="Download iCalendar (.ics)"
            >
              <Calendar className="w-3.5 h-3.5 text-orbit-cyan" />
              <span className="hidden sm:inline">.ICS</span>
            </a>
            <a
              href={exportUrl('csv')}
              download
              className="flex items-center space-x-1 px-2.5 py-1 bg-space-700/80 hover:bg-space-600 border border-space-600 rounded text-xs text-slate-200 transition"
              title="Download CSV SpreadSheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-orbit-green" />
              <span className="hidden sm:inline">CSV</span>
            </a>
          </div>
        </div>

        {/* Filter Controls: Min Elevation & Days Ahead */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-space-750">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Min Elevation:</span>
            <div className="flex items-center space-x-1">
              {[0, 10, 20, 30].map((deg) => (
                <button
                  key={deg}
                  onClick={() => setMinElevationFilter(deg)}
                  className={`px-2 py-0.5 rounded text-xs font-mono transition ${
                    minElevationFilter === deg
                      ? 'bg-orbit-cyan/20 text-orbit-cyan font-bold border border-orbit-cyan/40'
                      : 'text-slate-400 hover:text-slate-200 bg-space-900 border border-space-700'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Time Horizon:</span>
            <select
              value={daysAhead}
              onChange={(e) => setDaysAhead(Number(e.target.value))}
              className="bg-space-900 border border-space-700 rounded px-2 py-0.5 text-xs text-slate-200 outline-none"
            >
              <option value={1}>Next 24 Hours</option>
              <option value={3}>Next 3 Days</option>
              <option value={5}>Next 5 Days</option>
              <option value={7}>Next 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active / Next Pass Status Ticker */}
      {currentPass ? (
        <div className="px-4 py-2.5 bg-orbit-green/10 border-b border-orbit-green/30 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center space-x-2 text-orbit-green font-bold">
            <Sunrise className="w-4 h-4" />
            <span>ACTIVE PASS IN PROGRESS!</span>
          </div>
          <div className="font-mono text-slate-200">
            LOS in {Math.round(Math.max(0, currentPass.losTime - now) / 1000)}s
          </div>
        </div>
      ) : nextPass ? (
        <div className="px-4 py-2 bg-space-800/60 border-b border-space-700 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-orbit-cyan" />
            <span>
              Next Pass in:{' '}
              <strong className="text-orbit-cyan font-bold">
                {formatDuration(Math.round((nextPass.aosTime - now) / 1000))}
              </strong>
            </span>
          </div>
          <span className="text-slate-400 text-[11px]">
            Max El: {nextPass.maxElevationDeg.toFixed(0)}°
          </span>
        </div>
      ) : null}

      {/* Passes List Table */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingPasses ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Clock className="w-6 h-6 mx-auto mb-2 text-orbit-cyan animate-spin" />
            Calculating orbital passes...
          </div>
        ) : activePasses.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No passes found with elevation ≥ {minElevationFilter}° in the next {daysAhead} days.
          </div>
        ) : (
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-space-800/90 text-slate-400 sticky top-0 border-b border-space-700">
              <tr>
                <th className="py-2 px-3">AOS Time (UTC)</th>
                <th className="py-2 px-3">Duration</th>
                <th className="py-2 px-3 text-right">Max El</th>
                <th className="py-2 px-3 hidden sm:table-cell">AOS Az</th>
                <th className="py-2 px-3 hidden sm:table-cell">LOS Az</th>
                <th className="py-2 px-3">Visibility</th>
                <th className="py-2 px-2 text-center">Sim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-space-800">
              {activePasses.map((pass) => {
                const aosDate = new Date(pass.aosTime);
                const isOngoing = pass.aosTime <= now && pass.losTime >= now;

                return (
                  <tr
                    key={pass.id}
                    className={`transition ${
                      isOngoing
                        ? 'bg-orbit-green/10 text-white font-semibold'
                        : 'hover:bg-space-800/50 text-slate-300'
                    }`}
                  >
                    {/* AOS Time */}
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-200">
                        {aosDate.toISOString().slice(5, 16).replace('T', ' ')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Local:{' '}
                        {aosDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="py-2.5 px-3">{formatDuration(pass.durationSeconds)}</td>

                    {/* Max Elevation */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={getElevationColor(pass.maxElevationDeg)}>
                        {pass.maxElevationDeg.toFixed(1)}°
                      </span>
                    </td>

                    {/* AOS Azimuth */}
                    <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">
                      {pass.aosAzimuthDeg.toFixed(0)}°
                    </td>

                    {/* LOS Azimuth */}
                    <td className="py-2.5 px-3 text-slate-400 hidden sm:table-cell">
                      {pass.losAzimuthDeg.toFixed(0)}°
                    </td>

                    {/* Visibility condition */}
                    <td className="py-2.5 px-3">{getVisibilityBadge(pass.visibility)}</td>

                    {/* Jump time simulation to this pass */}
                    <td className="py-2.5 px-2 text-center">
                      <button
                        onClick={() =>
                          dispatchTimeAction({
                            type: 'SET_TIME',
                            payload: pass.aosTime,
                          })
                        }
                        className="p-1 rounded text-slate-400 hover:text-orbit-cyan hover:bg-space-700 transition"
                        title="Jump simulation time to this pass AOS"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 bg-space-800 border-t border-space-700 text-[11px] text-slate-400 flex items-center justify-between">
        <span>{activePasses.length} passes predicted</span>
        <span className="text-[10px]">Times in UTC & Local</span>
      </div>
    </div>
  );
};
