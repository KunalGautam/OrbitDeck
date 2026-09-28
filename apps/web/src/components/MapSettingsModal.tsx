import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Globe2, Key, Layers, X } from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';
import { MAP_PROVIDERS } from '../map/providerRegistry.js';
import { DEFAULT_TILE_SOURCES } from '../map/tileSources.js';

interface MapSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MapSettingsModal: React.FC<MapSettingsModalProps> = ({ isOpen, onClose }) => {
  const { mapProviderId, setMapProviderId, tileSource, setTileSource } = useOrbitDeck();

  const [cesiumToken, setCesiumToken] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('orbitdeck_cesium_token') || '';
    }
    return '';
  });
  const [tokenSaved, setTokenSaved] = useState(false);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleSaveCesiumToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof localStorage !== 'undefined') {
      if (cesiumToken.trim()) {
        localStorage.setItem('orbitdeck_cesium_token', cesiumToken.trim());
      } else {
        localStorage.removeItem('orbitdeck_cesium_token');
      }
    }
    setTokenSaved(true);
    setTimeout(() => setTokenSaved(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto select-none">
      <div className="bg-space-850 border border-space-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-space-800 border-b border-space-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Layers className="w-5 h-5 text-orbit-cyan" />
            <h2 className="text-sm sm:text-base font-bold text-slate-100">
              Map Engine & Layer Settings
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
        <div className="p-3 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Map Engine Selection */}
          <div className="space-y-2">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <Globe2 className="w-4 h-4 text-orbit-cyan" />
              <span>Map Engine (Runtime Selectable)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.values(MAP_PROVIDERS).map((p) => {
                const isSelected = p.id === mapProviderId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setMapProviderId(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-space-800 border-orbit-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]'
                        : 'bg-space-900/60 border-space-700 hover:bg-space-800/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100 text-xs">{p.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            p.capabilities.supports3D
                              ? 'bg-orbit-green/20 text-orbit-green'
                              : 'bg-space-700 text-slate-400'
                          }`}
                        >
                          {p.capabilities.supports3D ? '3D GLOBE' : '2D MAP'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 mt-2 pt-2 border-t border-space-750 text-[10px] text-slate-400">
                      {p.capabilities.supportsAtmosphere && <span>• Atmosphere</span>}
                      {p.capabilities.supportsTerrain && <span>• 3D Terrain</span>}
                      {p.capabilities.supportsVectorTiles && <span>• Vector Tiles</span>}
                      {p.capabilities.supportsCustomProjections && <span>• Projections</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tile Source Selection */}
          <div className="space-y-2">
            <div className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              Base Map Tile Source
            </div>
            <div className="space-y-2">
              {DEFAULT_TILE_SOURCES.map((src) => {
                const isSelected = src.id === tileSource.id;
                return (
                  <div
                    key={src.id}
                    onClick={() => setTileSource(src)}
                    className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-space-800 border-orbit-green shadow-[0_0_10px_rgba(0,230,118,0.15)]'
                        : 'bg-space-900/60 border-space-700 hover:bg-space-800/50'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-200 text-xs">{src.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate max-w-sm mt-0.5">
                        {src.url}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-orbit-green flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cesium Ion Access Token (Optional) */}
          <div className="bg-space-900 border border-space-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center space-x-1.5 text-slate-200 font-bold text-xs">
              <Key className="w-3.5 h-3.5 text-orbit-amber" />
              <span>Cesium Ion Access Token (Optional)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Cesium 3D Globe runs out-of-the-box with free OpenStreetMap tiles. Provide your own
              Cesium Ion access token to unlock Bing aerial photorealistic terrain and high-res
              global photogrammetry.
            </p>
            <form
              onSubmit={handleSaveCesiumToken}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
            >
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                value={cesiumToken}
                onChange={(e) => setCesiumToken(e.target.value)}
                className="flex-1 bg-space-850 border border-space-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-[11px] outline-none focus:border-orbit-cyan"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-space-700 hover:bg-space-600 border border-space-600 rounded text-slate-200 font-medium text-xs transition"
              >
                {tokenSaved ? 'Saved!' : 'Save'}
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-5 py-3 bg-space-800 border-t border-space-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-space-700 text-slate-200 hover:bg-space-600 transition text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
