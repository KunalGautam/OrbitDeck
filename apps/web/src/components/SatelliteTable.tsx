import React, { useMemo, useState } from 'react';
import type { SatelliteGroup } from '@orbitdeck/shared';
import { ArrowDown, ArrowUp, Crosshair, Eye, Search, Star } from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

type SortField = 'name' | 'noradId' | 'elevation' | 'altitude';
type SortOrder = 'asc' | 'desc';

export const SatelliteTable: React.FC = () => {
  const {
    satellites,
    filteredSatellites,
    selectedSatId,
    setSelectedSatId,
    followedSatId,
    setFollowedSatId,
    toggleSatFavorite,
    frames,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    onlyInView,
    setOnlyInView,
  } = useOrbitDeck();

  const [sortField, setSortField] = useState<SortField>('elevation');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const groups: { id: SatelliteGroup | 'all' | 'favorites'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'stations', label: 'Space Stations' },
    { id: 'amateur', label: 'Amateur Radio' },
    { id: 'weather', label: 'Weather' },
    { id: 'gnss', label: 'GNSS / GPS' },
    { id: 'cubesat', label: 'CubeSats' },
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedSats = useMemo(() => {
    return [...filteredSatellites].sort((a, b) => {
      const frameA = frames.get(a.noradId);
      const frameB = frames.get(b.noradId);

      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'noradId':
          valA = a.noradId;
          valB = b.noradId;
          break;
        case 'elevation':
          valA = frameA?.elevationDeg ?? -999;
          valB = frameB?.elevationDeg ?? -999;
          break;
        case 'altitude':
          valA = frameA?.altitudeKm ?? 0;
          valB = frameB?.altitudeKm ?? 0;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredSatellites, frames, sortField, sortOrder]);

  return (
    <div className="h-full bg-space-850 border border-space-700 rounded-lg flex flex-col overflow-hidden select-none">
      {/* Header Controls */}
      <div className="p-3 bg-space-800 border-b border-space-700 space-y-2.5">
        {/* Search bar and in-view toggle */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by satellite name or NORAD ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-space-900 border border-space-700 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orbit-cyan transition"
            />
          </div>

          <button
            onClick={() => setOnlyInView(!onlyInView)}
            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs border transition ${
              onlyInView
                ? 'bg-orbit-green/20 border-orbit-green text-orbit-green font-bold'
                : 'bg-space-900 border-space-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Filter to satellites currently above your horizon"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In View</span>
          </button>
        </div>

        {/* Group Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-0.5 text-xs">
          {groups.map((grp) => (
            <button
              key={grp.id}
              onClick={() => setSelectedGroup(grp.id)}
              className={`px-2 py-0.5 rounded whitespace-nowrap transition ${
                selectedGroup === grp.id
                  ? 'bg-orbit-cyan/20 text-orbit-cyan font-bold border border-orbit-cyan/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-space-750'
              }`}
            >
              {grp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-space-800/90 text-slate-400 font-mono sticky top-0 z-10 border-b border-space-700">
            <tr>
              <th className="py-2 px-3 w-8"></th>
              <th
                onClick={() => handleSort('name')}
                className="py-2 px-3 cursor-pointer hover:text-slate-200"
              >
                <div className="flex items-center space-x-1">
                  <span>Satellite</span>
                  {sortField === 'name' &&
                    (sortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-orbit-cyan" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-orbit-cyan" />
                    ))}
                </div>
              </th>
              <th
                onClick={() => handleSort('noradId')}
                className="py-2 px-2 cursor-pointer hover:text-slate-200 hidden sm:table-cell"
              >
                <div className="flex items-center space-x-1">
                  <span>NORAD</span>
                  {sortField === 'noradId' &&
                    (sortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-orbit-cyan" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-orbit-cyan" />
                    ))}
                </div>
              </th>
              <th
                onClick={() => handleSort('elevation')}
                className="py-2 px-3 cursor-pointer hover:text-slate-200 text-right"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>El (°)</span>
                  {sortField === 'elevation' &&
                    (sortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-orbit-cyan" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-orbit-cyan" />
                    ))}
                </div>
              </th>
              <th className="py-2 px-3 text-right hidden md:table-cell">Az (°)</th>
              <th
                onClick={() => handleSort('altitude')}
                className="py-2 px-3 cursor-pointer hover:text-slate-200 text-right hidden lg:table-cell"
              >
                <div className="flex items-center justify-end space-x-1">
                  <span>Alt (km)</span>
                  {sortField === 'altitude' &&
                    (sortOrder === 'asc' ? (
                      <ArrowUp className="w-3 h-3 text-orbit-cyan" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-orbit-cyan" />
                    ))}
                </div>
              </th>
              <th className="py-2 px-3 w-10 text-center">Track</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-space-800 font-mono">
            {filteredAndSortedSats.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                  No satellites match the current filter.
                </td>
              </tr>
            ) : (
              filteredAndSortedSats.map((sat) => {
                const isSelected = sat.noradId === selectedSatId;
                const isFollowed = sat.noradId === followedSatId;
                const frame = frames.get(sat.noradId);
                const isInView = frame?.elevationDeg !== undefined && frame.elevationDeg > 0;

                return (
                  <tr
                    key={sat.noradId}
                    onClick={() => setSelectedSatId(sat.noradId)}
                    className={`cursor-pointer transition ${
                      isSelected
                        ? 'bg-orbit-cyan/10 border-l-2 border-l-orbit-cyan text-white'
                        : 'hover:bg-space-800/60 text-slate-300'
                    }`}
                  >
                    {/* Star Favorite */}
                    <td
                      className="py-2 px-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSatFavorite(sat.noradId);
                      }}
                    >
                      <Star
                        className={`w-3.5 h-3.5 transition ${
                          sat.isFavorite
                            ? 'text-orbit-amber fill-orbit-amber'
                            : 'text-slate-600 hover:text-orbit-amber'
                        }`}
                      />
                    </td>

                    {/* Name & Primary group */}
                    <td className="py-2 px-3">
                      <div className="font-semibold truncate max-w-[140px] sm:max-w-[180px]">
                        {sat.name}
                      </div>
                      <div className="text-[10px] text-slate-400 capitalize">
                        {sat.groups[0] || 'satellite'}
                      </div>
                    </td>

                    {/* NORAD */}
                    <td className="py-2 px-2 text-slate-400 hidden sm:table-cell text-[11px]">
                      {sat.noradId}
                    </td>

                    {/* Elevation */}
                    <td className="py-2 px-3 text-right">
                      {frame?.elevationDeg !== undefined ? (
                        <span
                          className={`font-semibold ${
                            isInView
                              ? 'text-orbit-green font-bold bg-orbit-green/10 px-1 py-0.5 rounded'
                              : 'text-slate-400'
                          }`}
                        >
                          {frame.elevationDeg > 0 ? '+' : ''}
                          {frame.elevationDeg.toFixed(1)}°
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Azimuth */}
                    <td className="py-2 px-3 text-right text-slate-400 hidden md:table-cell">
                      {frame?.azimuthDeg !== undefined ? `${frame.azimuthDeg.toFixed(0)}°` : '—'}
                    </td>

                    {/* Altitude */}
                    <td className="py-2 px-3 text-right text-slate-400 hidden lg:table-cell">
                      {frame?.altitudeKm !== undefined ? `${Math.round(frame.altitudeKm)}` : '—'}
                    </td>

                    {/* Track / Follow Icon */}
                    <td
                      className="py-2 px-3 text-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSatId(sat.noradId);
                        setFollowedSatId(isFollowed ? null : sat.noradId);
                      }}
                    >
                      <button
                        className={`p-1 rounded transition ${
                          isFollowed
                            ? 'text-orbit-cyan bg-orbit-cyan/20'
                            : 'text-slate-500 hover:text-orbit-cyan hover:bg-space-700'
                        }`}
                        title={isFollowed ? 'Unfollow' : 'Follow on Map'}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Status */}
      <div className="px-3 py-2 bg-space-800 border-t border-space-700 text-[11px] text-slate-400 flex items-center justify-between">
        <span>
          Showing {filteredAndSortedSats.length} of {satellites.length} satellites
        </span>
        {onlyInView && (
          <span className="text-orbit-green font-semibold">Filtered: Above Horizon</span>
        )}
      </div>
    </div>
  );
};
