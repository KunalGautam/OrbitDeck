import React, { useEffect, useState } from 'react';
import type { HamlibStatus, Transponder } from '@orbitdeck/shared';
import { calculateDopplerShift } from '@orbitdeck/shared';
import {
  ArrowDownRight,
  ArrowUpRight,
  Cpu,
  Radio,
  RefreshCw,
  Send,
  Volume2,
  Zap,
} from 'lucide-react';
import * as api from '../api/client.js';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

export const RadioPanel: React.FC = () => {
  const { selectedSatellite, selectedFrame, activeStation } = useOrbitDeck();

  const [transponders, setTransponders] = useState<Transponder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hamlibStatus, setHamlibStatus] = useState<HamlibStatus | null>(null);
  const [autoTrackRotator, setAutoTrackRotator] = useState(false);
  const [rotatorMessage, setRotatorMessage] = useState<string | null>(null);

  // Fetch transponders when selected satellite changes
  useEffect(() => {
    if (!selectedSatellite) {
      setTransponders([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    api
      .fetchTransponders(selectedSatellite.noradId, activeStation?.id)
      .then((res) => {
        if (isMounted) {
          setTransponders(res.transponders);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch transponders:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSatellite, activeStation]);

  // Fetch Hamlib status
  useEffect(() => {
    const fetchStatus = () => {
      api
        .fetchHamlibStatus()
        .then((res) => setHamlibStatus(res.status))
        .catch(() => {});
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-track rotator if enabled and satellite has valid az/el
  useEffect(() => {
    if (
      autoTrackRotator &&
      selectedFrame?.azimuthDeg !== undefined &&
      selectedFrame?.elevationDeg !== undefined
    ) {
      // Only command above horizon
      if (selectedFrame.elevationDeg >= 0) {
        api
          .setHamlibRotator(
            Math.round(selectedFrame.azimuthDeg * 10) / 10,
            Math.round(selectedFrame.elevationDeg * 10) / 10,
          )
          .catch(() => {});
      }
    }
  }, [autoTrackRotator, selectedFrame]);

  if (!selectedSatellite) {
    return (
      <div className="h-full bg-space-850 border border-space-700 rounded-lg p-6 flex flex-col items-center justify-center text-slate-400">
        <Radio className="w-10 h-10 mb-2 text-slate-600 animate-pulse" />
        <p className="text-sm">Select a satellite to view radio transponders & Doppler shift</p>
      </div>
    );
  }

  const rangeRate = selectedFrame?.rangeRateKmS ?? 0;

  const formatFreq = (hz: number) => {
    return `${(hz / 1e6).toFixed(6)} MHz`;
  };

  const handleManualRotatorTrack = async () => {
    if (selectedFrame?.azimuthDeg === undefined || selectedFrame?.elevationDeg === undefined)
      return;

    try {
      const az = Math.round(selectedFrame.azimuthDeg * 10) / 10;
      const el = Math.max(0, Math.round(selectedFrame.elevationDeg * 10) / 10);
      await api.setHamlibRotator(az, el);
      setRotatorMessage(`Rotator commanded to Az ${az}°, El ${el}°`);
      setTimeout(() => setRotatorMessage(null), 3000);
    } catch {
      setRotatorMessage('Failed to command rotator (check hamlib bridge)');
      setTimeout(() => setRotatorMessage(null), 3000);
    }
  };

  const handleTuneRig = async (freqHz: number) => {
    try {
      await api.setHamlibFrequency(Math.round(freqHz));
      setRotatorMessage(`Rig tuned to ${(freqHz / 1e6).toFixed(4)} MHz`);
      setTimeout(() => setRotatorMessage(null), 3000);
    } catch {
      setRotatorMessage('Failed to tune rig');
      setTimeout(() => setRotatorMessage(null), 3000);
    }
  };

  return (
    <div className="h-full bg-space-850 border border-space-700 rounded-lg flex flex-col overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-3 bg-space-800 border-b border-space-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded bg-space-900 border border-orbit-cyan/40 flex items-center justify-center text-orbit-cyan">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              Radio & Doppler: {selectedSatellite.name}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              SatNOGS DB • QTH: {activeStation?.name || 'Default Station'}
            </p>
          </div>
        </div>

        {/* Doppler Range Rate Readout */}
        <div className="bg-space-900 px-3 py-1 rounded border border-space-700 text-right font-mono">
          <div className="text-[10px] text-slate-400">Range Rate (Doppler)</div>
          <div
            className={`text-xs font-bold ${
              rangeRate < 0 ? 'text-orbit-green' : 'text-orbit-amber'
            }`}
          >
            {rangeRate > 0 ? '+' : ''}
            {rangeRate.toFixed(2)} km/s ({rangeRate < 0 ? 'Approaching' : 'Receding'})
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Hamlib Bridge Control Card */}
        <div className="bg-space-800/80 border border-space-700 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-orbit-cyan" />
              <span className="font-bold text-xs text-slate-200">
                Hamlib Hardware Control (rigctld / rotctld)
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[10px] font-mono">
              <span className="flex items-center space-x-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hamlibStatus?.connectedRot ? 'bg-orbit-green' : 'bg-slate-500'
                  }`}
                />
                <span className="text-slate-400">Rotator</span>
              </span>
              <span className="flex items-center space-x-1">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    hamlibStatus?.connectedRig ? 'bg-orbit-green' : 'bg-slate-500'
                  }`}
                />
                <span className="text-slate-400">Rig</span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-space-750 text-xs">
            <div className="flex items-center space-x-2 font-mono text-[11px] text-slate-300">
              <span>Target:</span>
              <span className="text-orbit-cyan font-bold">
                Az{' '}
                {selectedFrame?.azimuthDeg !== undefined
                  ? selectedFrame.azimuthDeg.toFixed(1)
                  : '—'}
                °
              </span>
              <span>•</span>
              <span className="text-orbit-cyan font-bold">
                El{' '}
                {selectedFrame?.elevationDeg !== undefined
                  ? selectedFrame.elevationDeg.toFixed(1)
                  : '—'}
                °
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setAutoTrackRotator(!autoTrackRotator)}
                className={`px-2.5 py-1 rounded text-xs border font-medium transition ${
                  autoTrackRotator
                    ? 'bg-orbit-cyan/20 border-orbit-cyan text-orbit-cyan font-bold'
                    : 'bg-space-900 border-space-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {autoTrackRotator ? 'Auto-Track: ACTIVE' : 'Auto-Track Rotator'}
              </button>
              <button
                onClick={handleManualRotatorTrack}
                disabled={selectedFrame?.azimuthDeg === undefined}
                className="px-2.5 py-1 rounded text-xs bg-space-700 hover:bg-space-600 border border-space-600 text-slate-200 transition disabled:opacity-50"
              >
                Track Once
              </button>
            </div>
          </div>

          {rotatorMessage && (
            <div className="text-[11px] text-orbit-cyan bg-orbit-cyan/10 border border-orbit-cyan/20 px-2 py-1 rounded">
              {rotatorMessage}
            </div>
          )}
        </div>

        {/* Transponders List */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-orbit-amber" />
            <span>Active Transponders & Beacons ({transponders.length})</span>
          </h4>

          {isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs font-mono">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 text-orbit-cyan animate-spin" />
              Loading SatNOGS transponder database...
            </div>
          ) : transponders.length === 0 ? (
            <div className="p-6 bg-space-800/40 border border-space-700 rounded-lg text-center text-slate-400 text-xs">
              No transmitters registered in SatNOGS database for this satellite.
            </div>
          ) : (
            <div className="space-y-3">
              {transponders.map((tp) => {
                const downlinkNominal = tp.downlinkLowHz ?? tp.downlinkHighHz;
                const uplinkNominal = tp.uplinkLowHz ?? tp.uplinkHighHz;

                const downlinkDoppler = downlinkNominal
                  ? calculateDopplerShift(downlinkNominal, rangeRate)
                  : null;
                const uplinkDoppler = uplinkNominal
                  ? calculateDopplerShift(uplinkNominal, rangeRate)
                  : null;

                return (
                  <div
                    key={tp.id}
                    className="bg-space-800/90 border border-space-700 rounded-lg p-3 space-y-2 font-mono hover:border-space-600 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-100">
                          {tp.description || 'Transceiver'}
                        </span>
                        {tp.mode && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-space-700 text-orbit-cyan font-bold border border-space-600">
                            {tp.mode}
                          </span>
                        )}
                        {tp.invert && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orbit-amber/20 text-orbit-amber border border-orbit-amber/30">
                            INVERTING
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          tp.alive !== false
                            ? 'bg-orbit-green/20 text-orbit-green border border-orbit-green/30'
                            : 'bg-space-700 text-slate-500'
                        }`}
                      >
                        {tp.alive !== false ? 'OPERATIONAL' : 'INACTIVE'}
                      </span>
                    </div>

                    {/* Frequencies Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {/* Downlink */}
                      {downlinkNominal && downlinkDoppler && (
                        <div className="bg-space-900/80 p-2.5 rounded border border-space-750 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="flex items-center space-x-1 text-orbit-cyan font-semibold">
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              <span>Downlink (Rx)</span>
                            </span>
                            <button
                              onClick={() => handleTuneRig(downlinkDoppler.receivedFreqHz)}
                              className="text-[10px] text-orbit-cyan hover:underline flex items-center space-x-0.5"
                              title="Tune radio rig to Doppler-corrected frequency"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Tune Rx</span>
                            </button>
                          </div>

                          <div className="text-slate-100 font-bold text-sm">
                            {formatFreq(downlinkDoppler.receivedFreqHz)}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Nominal: {formatFreq(downlinkNominal)}</span>
                            <span
                              className={`font-semibold ${
                                downlinkDoppler.shiftHz >= 0
                                  ? 'text-orbit-green'
                                  : 'text-orbit-amber'
                              }`}
                            >
                              {downlinkDoppler.shiftHz >= 0 ? '+' : ''}
                              {Math.round(downlinkDoppler.shiftHz)} Hz
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Uplink */}
                      {uplinkNominal && uplinkDoppler && (
                        <div className="bg-space-900/80 p-2.5 rounded border border-space-750 space-y-1">
                          <div className="flex items-center justify-between text-slate-400 text-[11px]">
                            <span className="flex items-center space-x-1 text-orbit-amber font-semibold">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              <span>Uplink (Tx)</span>
                            </span>
                            <button
                              onClick={() => handleTuneRig(uplinkDoppler.receivedFreqHz)}
                              className="text-[10px] text-orbit-amber hover:underline flex items-center space-x-0.5"
                              title="Tune transmitter to Doppler-corrected frequency"
                            >
                              <Send className="w-3 h-3" />
                              <span>Tune Tx</span>
                            </button>
                          </div>

                          <div className="text-slate-100 font-bold text-sm">
                            {formatFreq(uplinkDoppler.receivedFreqHz)}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>Nominal: {formatFreq(uplinkNominal)}</span>
                            <span
                              className={`font-semibold ${
                                uplinkDoppler.shiftHz >= 0 ? 'text-orbit-green' : 'text-orbit-amber'
                              }`}
                            >
                              {uplinkDoppler.shiftHz >= 0 ? '+' : ''}
                              {Math.round(uplinkDoppler.shiftHz)} Hz
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
