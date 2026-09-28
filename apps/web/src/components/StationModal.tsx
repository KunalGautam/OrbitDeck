import React, { useState } from 'react';
import type { CreateGroundStationInput, GroundStation } from '@orbitdeck/shared';
import { latLonToMaidenhead, maidenheadToLatLon } from '@orbitdeck/shared';
import { Check, LocateFixed, MapPin, Plus, Trash2, X } from 'lucide-react';
import * as api from '../api/client.js';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

interface StationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StationModal: React.FC<StationModalProps> = ({ isOpen, onClose }) => {
  const { stations, activeStation, setActiveStationId, addStation, removeStation } = useOrbitDeck();

  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('0');
  const [longitude, setLongitude] = useState('0');
  const [altitudeM, setAltitudeM] = useState('50');
  const [maidenhead, setMaidenhead] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  // Handle Lat/Lon Change -> Auto-update Maidenhead
  const handleLatLonChange = (newLat: string, newLon: string) => {
    setLatitude(newLat);
    setLongitude(newLon);
    const lat = parseFloat(newLat);
    const lon = parseFloat(newLon);
    if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      try {
        setMaidenhead(latLonToMaidenhead(lat, lon, 6));
      } catch {
        // ignore
      }
    }
  };

  // Handle Maidenhead Change -> Auto-update Lat/Lon
  const handleMaidenheadChange = (grid: string) => {
    setMaidenhead(grid);
    if (grid.length >= 4) {
      try {
        const coords = maidenheadToLatLon(grid);
        setLatitude(coords.latitude.toFixed(4));
        setLongitude(coords.longitude.toFixed(4));
      } catch {
        // ignore incomplete inputs
      }
    }
  };

  // Use browser geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const alt = pos.coords.altitude || 50;
        setLatitude(lat.toFixed(4));
        setLongitude(lon.toFixed(4));
        setAltitudeM(Math.round(alt).toString());
        setMaidenhead(latLonToMaidenhead(lat, lon, 6));
        setGeoError(null);
      },
      (err) => {
        setGeoError(err.message || 'Failed to obtain current location');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const alt = parseFloat(altitudeM);
      const grid = maidenhead.trim() || latLonToMaidenhead(lat, lon, 6);

      const input: CreateGroundStationInput = {
        name: name.trim(),
        latitude: lat,
        longitude: lon,
        altitude: alt,
        maidenhead: grid,
        isDefault,
      };

      await addStation(input);
      setIsAdding(false);
      setName('');
      setIsDefault(false);
    } catch (err: any) {
      setGeoError(err.message || 'Failed to create ground station');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (st: GroundStation) => {
    await api.setDefaultStation(st.id);
    setActiveStationId(st.id);
    // Reload stations in context via activeStationId trigger
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-space-850 border border-space-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-space-800 border-b border-space-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-orbit-green" />
            <h2 className="text-base font-bold text-slate-100">Ground Stations (QTH Locators)</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-space-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Existing Stations List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <span>Saved Stations</span>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center space-x-1 text-orbit-cyan hover:underline text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Station</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {stations.map((st) => {
                const isActive = st.id === activeStation?.id;
                return (
                  <div
                    key={st.id}
                    onClick={() => setActiveStationId(st.id)}
                    className={`p-3 rounded-lg border transition flex items-center justify-between cursor-pointer ${
                      isActive
                        ? 'bg-space-800 border-orbit-green shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                        : 'bg-space-900/60 border-space-700 hover:bg-space-800/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-slate-100">{st.name}</span>
                        {st.isDefault && (
                          <span className="text-[10px] bg-orbit-green/20 text-orbit-green px-1.5 py-0.5 rounded font-bold border border-orbit-green/30">
                            DEFAULT
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] bg-orbit-cyan/20 text-orbit-cyan px-1.5 py-0.5 rounded font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        <span>Grid: {st.maidenhead}</span> •{' '}
                        <span>
                          {st.latitude >= 0
                            ? `${st.latitude.toFixed(2)}°N`
                            : `${Math.abs(st.latitude).toFixed(2)}°S`}
                          ,{' '}
                          {st.longitude >= 0
                            ? `${st.longitude.toFixed(2)}°E`
                            : `${Math.abs(st.longitude).toFixed(2)}°W`}
                        </span>{' '}
                        • <span>{st.altitude}m MSL</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {!st.isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(st);
                          }}
                          className="px-2 py-1 text-[10px] rounded bg-space-700 text-slate-300 hover:text-white hover:bg-space-600 transition"
                          title="Set as Default QTH"
                        >
                          Make Default
                        </button>
                      )}
                      {stations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStation(st.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-orbit-red hover:bg-space-700 rounded transition"
                          title="Delete Station"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Station Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateStation}
              className="bg-space-900 border border-space-700 rounded-lg p-4 space-y-3 pt-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-space-750">
                <span className="font-bold text-xs text-slate-200">New Ground Station</span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="flex items-center space-x-1 text-xs text-orbit-cyan hover:underline"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Use My Location</span>
                </button>
              </div>

              {geoError && (
                <div className="text-[11px] text-orbit-red bg-orbit-red/10 border border-orbit-red/30 p-2 rounded">
                  {geoError}
                </div>
              )}

              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Station Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Home QTH, Field Site"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 outline-none focus:border-orbit-cyan"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Latitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-90"
                    max="90"
                    required
                    value={latitude}
                    onChange={(e) => handleLatLonChange(e.target.value, longitude)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Longitude (°)</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-180"
                    max="180"
                    required
                    value={longitude}
                    onChange={(e) => handleLatLonChange(latitude, e.target.value)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Maidenhead Grid</label>
                  <input
                    type="text"
                    placeholder="e.g. FN31pr"
                    maxLength={8}
                    value={maidenhead}
                    onChange={(e) => handleMaidenheadChange(e.target.value)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono uppercase outline-none focus:border-orbit-cyan"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Altitude (m MSL)</label>
                  <input
                    type="number"
                    step="1"
                    min="-400"
                    max="9000"
                    value={altitudeM}
                    onChange={(e) => setAltitudeM(e.target.value)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="setDefault"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded bg-space-850 border-space-700 text-orbit-green focus:ring-0 cursor-pointer"
                />
                <label htmlFor="setDefault" className="text-slate-300 cursor-pointer text-xs">
                  Set as default station
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-space-750">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 rounded bg-space-800 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded bg-orbit-cyan text-space-950 font-bold hover:bg-orbit-cyan/90 transition flex items-center space-x-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Station</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-space-800 border-t border-space-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-space-700 text-slate-200 hover:bg-space-600 transition text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
