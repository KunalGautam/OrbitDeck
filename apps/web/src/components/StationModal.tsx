import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  CreateGroundStationInput,
  GroundStation,
  UpdateGroundStationInput,
} from '@orbitdeck/shared';
import { latLonToMaidenhead, maidenheadToLatLon } from '@orbitdeck/shared';
import { Check, Edit2, LocateFixed, Lock, MapPin, Plus, Trash2, X } from 'lucide-react';
import * as api from '../api/client.js';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

interface StationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StationModal: React.FC<StationModalProps> = ({ isOpen, onClose }) => {
  const { stations, activeStation, setActiveStationId, addStation, editStation, removeStation } =
    useOrbitDeck();

  const [isAdding, setIsAdding] = useState(false);
  const [editingStation, setEditingStation] = useState<GroundStation | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('0');
  const [longitude, setLongitude] = useState('0');
  const [altitudeM, setAltitudeM] = useState('50');
  const [maidenhead, setMaidenhead] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleStartAdd = () => {
    setEditingStation(null);
    setName('');
    setLatitude('0');
    setLongitude('0');
    setAltitudeM('50');
    setMaidenhead('');
    setIsDefault(false);
    setGeoError(null);
    setIsAdding(true);
  };

  const handleStartEdit = (st: GroundStation) => {
    setIsAdding(false);
    setEditingStation(st);
    setName(st.name);
    setLatitude(st.latitude.toFixed(4));
    setLongitude(st.longitude.toFixed(4));
    setAltitudeM(Math.round(st.altitude).toString());
    setMaidenhead(st.maidenhead || '');
    setIsDefault(st.isDefault || false);
    setGeoError(null);
  };

  const handleCancelForm = () => {
    setIsAdding(false);
    setEditingStation(null);
    setGeoError(null);
  };

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
      handleCancelForm();
    } catch (err: any) {
      setGeoError(err.message || 'Failed to create ground station');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStation) return;

    setIsSubmitting(true);
    try {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      const alt = parseFloat(altitudeM);
      const grid = maidenhead.trim() || latLonToMaidenhead(lat, lon, 6);

      const input: UpdateGroundStationInput = {
        name: name.trim(),
        altitude: alt,
        isDefault,
      };

      // Only allow updating coordinates if not protected
      const isProtected =
        editingStation.isProtected ||
        ['MK68XO', 'IO93PL'].includes(editingStation.maidenhead?.toUpperCase() || '');

      if (!isProtected) {
        input.latitude = lat;
        input.longitude = lon;
        input.maidenhead = grid;
      }

      await editStation(editingStation.id, input);
      if (isDefault) {
        await api.setDefaultStation(editingStation.id);
      }
      handleCancelForm();
    } catch (err: any) {
      setGeoError(err.message || 'Failed to update ground station');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetDefault = async (st: GroundStation) => {
    await api.setDefaultStation(st.id);
    setActiveStationId(st.id);
  };

  const isEditingProtected =
    editingStation &&
    (editingStation.isProtected ||
      ['MK68XO', 'IO93PL'].includes(editingStation.maidenhead?.toUpperCase() || ''));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-space-850 border border-space-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-space-800 border-b border-space-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-orbit-green" />
            <h2 className="text-sm sm:text-base font-bold text-slate-100">
              Ground Stations (QTH Locators)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-space-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Existing Stations List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <span>Saved Stations ({stations.length})</span>
              {!isAdding && !editingStation && (
                <button
                  onClick={handleStartAdd}
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
                const isProtected =
                  st.isProtected ||
                  ['MK68XO', 'IO93PL'].includes(st.maidenhead?.toUpperCase() || '');
                const isCurrentEditing = editingStation?.id === st.id;

                return (
                  <div
                    key={st.id}
                    onClick={() => setActiveStationId(st.id)}
                    className={`p-3 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-2 ${
                      isCurrentEditing
                        ? 'bg-space-800 border-orbit-cyan ring-1 ring-orbit-cyan'
                        : isActive
                          ? 'bg-space-800 border-orbit-green shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                          : 'bg-space-900/60 border-space-700 hover:bg-space-800/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="font-bold text-sm text-slate-100 truncate">{st.name}</span>
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
                        {isProtected && (
                          <span className="text-[10px] bg-space-700 text-orbit-cyan px-1.5 py-0.5 rounded font-semibold flex items-center space-x-1 border border-space-600">
                            <Lock className="w-2.5 h-2.5" />
                            <span>LOCKED</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap gap-x-2">
                        <span>Grid: {st.maidenhead}</span>
                        <span>•</span>
                        <span>
                          {st.latitude >= 0
                            ? `${st.latitude.toFixed(2)}°N`
                            : `${Math.abs(st.latitude).toFixed(2)}°S`}
                          ,{' '}
                          {st.longitude >= 0
                            ? `${st.longitude.toFixed(2)}°E`
                            : `${Math.abs(st.longitude).toFixed(2)}°W`}
                        </span>
                        <span>•</span>
                        <span>{st.altitude}m MSL</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 sm:space-x-1.5 self-end sm:self-center">
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

                      {/* Edit Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(st);
                        }}
                        className={`p-1.5 rounded transition ${
                          isCurrentEditing
                            ? 'text-orbit-cyan bg-space-700'
                            : 'text-slate-400 hover:text-orbit-cyan hover:bg-space-700'
                        }`}
                        title="Edit Station"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button / Lock */}
                      {isProtected ? (
                        <span
                          className="p-1.5 text-slate-600 cursor-not-allowed"
                          title="Protected Ground Station (cannot be deleted)"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      ) : (
                        stations.length > 1 && (
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
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add or Edit Station Form */}
          {(isAdding || editingStation) && (
            <form
              onSubmit={editingStation ? handleUpdateStation : handleCreateStation}
              className="bg-space-900 border border-space-700 rounded-lg p-3 sm:p-4 space-y-3 pt-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-space-750">
                <span className="font-bold text-xs text-slate-200">
                  {editingStation ? `Edit Station: ${editingStation.name}` : 'New Ground Station'}
                </span>
                {!isEditingProtected && (
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="flex items-center space-x-1 text-xs text-orbit-cyan hover:underline"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>Use My Location</span>
                  </button>
                )}
              </div>

              {isEditingProtected && (
                <div className="text-[11px] text-orbit-cyan bg-orbit-cyan/10 border border-orbit-cyan/30 p-2 rounded flex items-center space-x-1.5">
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    This reference station is protected. You can adjust altitude or name;
                    coordinates are locked.
                  </span>
                </div>
              )}

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
                  className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 outline-none focus:border-orbit-cyan text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Latitude (°){isEditingProtected ? ' [Locked]' : ''}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-90"
                    max="90"
                    required
                    disabled={Boolean(isEditingProtected)}
                    value={latitude}
                    onChange={(e) => handleLatLonChange(e.target.value, longitude)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Longitude (°){isEditingProtected ? ' [Locked]' : ''}
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="-180"
                    max="180"
                    required
                    disabled={Boolean(isEditingProtected)}
                    value={longitude}
                    onChange={(e) => handleLatLonChange(latitude, e.target.value)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Maidenhead Grid{isEditingProtected ? ' [Locked]' : ''}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FN31pr"
                    maxLength={8}
                    disabled={Boolean(isEditingProtected)}
                    value={maidenhead}
                    onChange={(e) => handleMaidenheadChange(e.target.value)}
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono uppercase outline-none focus:border-orbit-cyan text-xs disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="w-full bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 font-mono outline-none focus:border-orbit-cyan text-xs"
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
                  onClick={handleCancelForm}
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
                  <span>{editingStation ? 'Update Station' : 'Save Station'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 bg-space-800 border-t border-space-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-space-700 text-slate-200 hover:bg-space-600 transition text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
