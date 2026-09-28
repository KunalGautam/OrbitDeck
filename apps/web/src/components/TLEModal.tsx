import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  ExternalLink,
  HardDrive,
  Lock,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

interface TLEModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TLEModal: React.FC<TLEModalProps> = ({ isOpen, onClose }) => {
  const {
    satellites,
    tleSources,
    tleProgress,
    isRefreshingTLE,
    refreshTLEData,
    addCustomTLESource,
    removeCustomTLESource,
  } = useOrbitDeck();

  const [isAdding, setIsAdding] = useState(false);
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceGroup, setSourceGroup] = useState('custom');
  const [addError, setAddError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceName.trim() || !sourceUrl.trim()) {
      setAddError('Name and URL are required');
      return;
    }

    try {
      new URL(sourceUrl.trim());
    } catch {
      setAddError('Please enter a valid HTTP/HTTPS URL');
      return;
    }

    setIsSubmitting(true);
    setAddError(null);
    try {
      await addCustomTLESource({
        name: sourceName.trim(),
        url: sourceUrl.trim(),
        group: sourceGroup.trim() || 'custom',
      });
      setSourceName('');
      setSourceUrl('');
      setSourceGroup('custom');
      setIsAdding(false);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add TLE source');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await removeCustomTLESource(id);
    } catch (err: any) {
      alert(err.message || 'Failed to delete source');
    }
  };

  const isBusy = isRefreshingTLE || Boolean(tleProgress?.isRefreshing);
  const progressPercent = Math.max(0, Math.min(100, Math.round(tleProgress?.percent ?? 0)));

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-space-850 border border-space-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Header */}
        <div className="px-5 py-3.5 bg-space-800 border-b border-space-700 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-orbit-cyan/10 text-orbit-cyan border border-orbit-cyan/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">TLE Data & Sources Manager</h2>
              <p className="text-[11px] text-slate-400">
                Configure orbital elements, custom sources, and offline browser cache
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-space-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Progress / Status Panel */}
          <div className="bg-space-900 border border-space-700 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isBusy ? (
                  <RefreshCw className="w-4 h-4 text-orbit-cyan animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-orbit-green" />
                )}
                <span className="font-semibold text-slate-200">
                  {isBusy ? 'Downloading & Updating TLEs...' : 'TLE Catalogue Status'}
                </span>
              </div>
              <button
                onClick={refreshTLEData}
                disabled={isBusy}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-orbit-cyan/20 border border-orbit-cyan/40 text-orbit-cyan hover:bg-orbit-cyan/30 transition text-xs font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                <span>{isBusy ? 'Updating...' : 'Update All Sources'}</span>
              </button>
            </div>

            {/* Progress Bar (Visible while refreshing or right after) */}
            {isBusy ? (
              <div className="space-y-2 pt-1">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-300 font-mono">
                    {tleProgress?.message || 'Processing orbital elements...'}
                  </span>
                  <span className="text-orbit-cyan font-bold font-mono text-xs">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-space-800 rounded-full h-2.5 overflow-hidden border border-space-700">
                  <div
                    className="bg-gradient-to-r from-orbit-cyan via-teal-400 to-orbit-green h-full transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(0,229,255,0.4)]"
                    style={{ width: `${Math.max(5, progressPercent)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>
                    Stage:{' '}
                    <span className="uppercase font-semibold text-orbit-cyan">
                      {tleProgress?.stage || 'downloading'}
                    </span>
                  </span>
                  {tleProgress?.completedSources !== undefined &&
                    tleProgress?.totalSources !== undefined && (
                      <span>
                        Sources: {tleProgress.completedSources} of {tleProgress.totalSources}
                      </span>
                    )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>
                  {satellites.length} satellites loaded and propagated in current catalogue.
                </span>
                {tleProgress?.updatedSatellites !== undefined && (
                  <span className="text-orbit-green font-mono">
                    +{tleProgress.updatedSatellites} updated in last run
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Browser Storage Card */}
          <div className="bg-space-900 border border-space-700 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orbit-green/10 text-orbit-green border border-orbit-green/30">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-slate-200 flex items-center space-x-2">
                  <span>Browser Storage (Offline Cache)</span>
                  <span className="text-[10px] bg-orbit-green/20 text-orbit-green px-1.5 py-0.2 rounded font-bold border border-orbit-green/30">
                    ACTIVE
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  TLE catalogue data is preserved in browser storage for instant offline startup.
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-orbit-cyan font-bold text-sm">
                {satellites.length}
              </span>
              <span className="text-slate-400 text-[10px] block">Satellites Saved</span>
            </div>
          </div>

          {/* Custom TLE Sources Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  TLE Feed Sources ({tleSources.length})
                </span>
                <p className="text-[11px] text-slate-400">
                  CelesTrak feeds and user-defined custom TLE endpoints.
                </p>
              </div>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-space-800 border border-space-700 text-orbit-cyan hover:bg-space-700 transition text-xs font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Source</span>
                </button>
              )}
            </div>

            {/* Add Custom Source Form */}
            {isAdding && (
              <form
                onSubmit={handleAddSource}
                className="bg-space-900 border border-space-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-space-750">
                  <span className="font-bold text-xs text-slate-200">Add Custom TLE Source</span>
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {addError && (
                  <div className="text-[11px] text-orbit-red bg-orbit-red/10 border border-orbit-red/30 p-2.5 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{addError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Source Name</label>
                    <input
                      type="text"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="e.g. Amateur Radio Satellites"
                      required
                      className="w-full bg-space-800 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-orbit-cyan outline-none text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      Group / Category
                    </label>
                    <select
                      value={sourceGroup}
                      onChange={(e) => setSourceGroup(e.target.value)}
                      className="w-full bg-space-800 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 focus:border-orbit-cyan outline-none text-xs"
                    >
                      <option value="amateur">Amateur Radio</option>
                      <option value="weather">Weather</option>
                      <option value="science">Science</option>
                      <option value="stations">Space Stations</option>
                      <option value="navigation">Navigation</option>
                      <option value="starlink">Starlink</option>
                      <option value="custom">Custom / Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    TLE Feed URL (3-Line or 2-Line Format)
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://celestrak.org/NORAD/elements/gp.php?GROUP=amateur&FORMAT=tle"
                    required
                    className="w-full bg-space-800 border border-space-700 rounded px-2.5 py-1.5 text-slate-100 placeholder-slate-500 focus:border-orbit-cyan outline-none font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-xs rounded bg-orbit-cyan text-space-950 font-bold hover:bg-orbit-cyan/90 transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Adding...' : 'Save Source'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Sources */}
            <div className="space-y-2">
              {tleSources.map((src) => {
                const isCustom = src.isCustom ?? false;
                return (
                  <div
                    key={src.id}
                    className="bg-space-900/60 border border-space-700 rounded-lg p-3 flex items-center justify-between hover:bg-space-800/40 transition"
                  >
                    <div className="space-y-1 overflow-hidden pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-200 text-xs">{src.name}</span>
                        {isCustom ? (
                          <span className="text-[10px] bg-orbit-cyan/20 text-orbit-cyan px-1.5 py-0.5 rounded font-bold border border-orbit-cyan/30">
                            CUSTOM
                          </span>
                        ) : (
                          <span className="text-[10px] bg-space-700 text-slate-400 px-1.5 py-0.5 rounded font-semibold flex items-center space-x-1 border border-space-600">
                            <Lock className="w-2.5 h-2.5" />
                            <span>BUILT-IN</span>
                          </span>
                        )}
                        {src.group && (
                          <span className="text-[10px] bg-space-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-space-750">
                            {src.group}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate flex items-center space-x-1">
                        <span className="truncate">{src.url}</span>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-orbit-cyan ml-1 flex-shrink-0"
                          title="Open URL in new tab"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div>
                      {isCustom ? (
                        <button
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1.5 text-slate-500 hover:text-orbit-red hover:bg-space-700 rounded transition"
                          title="Delete Custom Source"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span
                          className="p-1 text-slate-600 cursor-not-allowed"
                          title="Built-in default feed cannot be removed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-space-800 border-t border-space-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-space-700 text-slate-200 hover:text-white hover:bg-space-600 rounded-lg text-xs font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
