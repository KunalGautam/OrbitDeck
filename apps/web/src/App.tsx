import React, { useState } from 'react';
import { Header } from './components/Header.js';
import { MapSettingsModal } from './components/MapSettingsModal.js';
import { MapView } from './components/MapView.js';
import { PassPredictionPanel } from './components/PassPredictionPanel.js';
import { PolarSkyPlot } from './components/PolarSkyPlot.js';
import { RadioPanel } from './components/RadioPanel.js';
import { SatelliteDetailPanel } from './components/SatelliteDetailPanel.js';
import { SatelliteTable } from './components/SatelliteTable.js';
import { StationModal } from './components/StationModal.js';
import { OrbitDeckProvider, useOrbitDeck } from './context/OrbitDeckContext.js';

const MainLayout: React.FC = () => {
  const { viewMode } = useOrbitDeck();
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-space-900 text-slate-100 overflow-hidden">
      {/* Top Navigation & Mission Clock Bar */}
      <Header
        onOpenStationModal={() => setIsStationModalOpen(true)}
        onOpenMapSettings={() => setIsMapSettingsOpen(true)}
      />

      {/* Main Workspace View */}
      <main className="flex-1 overflow-hidden p-2">
        {viewMode === 'dashboard' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-2">
            {/* Left 7 Columns: 2D/3D Map & Satellite List */}
            <div className="lg:col-span-7 flex flex-col gap-2 h-full overflow-hidden">
              {/* Map (60% height) */}
              <div className="h-[60%] rounded-lg overflow-hidden border border-space-700 shadow-xl">
                <MapView />
              </div>
              {/* Satellite Table (40% height) */}
              <div className="h-[40%] rounded-lg overflow-hidden shadow-xl">
                <SatelliteTable />
              </div>
            </div>

            {/* Right 5 Columns: Polar Radar & Telemetry Detail */}
            <div className="lg:col-span-5 flex flex-col gap-2 h-full overflow-hidden">
              {/* Polar Plot (45% height) */}
              <div className="h-[45%] rounded-lg overflow-hidden shadow-xl">
                <PolarSkyPlot />
              </div>
              {/* Telemetry Detail (55% height) */}
              <div className="h-[55%] rounded-lg overflow-hidden shadow-xl">
                <SatelliteDetailPanel />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'map' && (
          <div className="h-full rounded-lg overflow-hidden border border-space-700 shadow-xl">
            <MapView />
          </div>
        )}

        {viewMode === 'polar' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-7 h-full">
              <PolarSkyPlot />
            </div>
            <div className="lg:col-span-5 h-full">
              <SatelliteDetailPanel />
            </div>
          </div>
        )}

        {viewMode === 'details' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-6 h-full">
              <SatelliteDetailPanel />
            </div>
            <div className="lg:col-span-6 h-full">
              <SatelliteTable />
            </div>
          </div>
        )}

        {viewMode === 'passes' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-8 h-full">
              <PassPredictionPanel />
            </div>
            <div className="lg:col-span-4 h-full">
              <PolarSkyPlot />
            </div>
          </div>
        )}

        {viewMode === 'radio' && (
          <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-7 h-full">
              <RadioPanel />
            </div>
            <div className="lg:col-span-5 h-full">
              <SatelliteDetailPanel />
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <StationModal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} />
      <MapSettingsModal isOpen={isMapSettingsOpen} onClose={() => setIsMapSettingsOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <OrbitDeckProvider>
      <MainLayout />
    </OrbitDeckProvider>
  );
};

export default App;
