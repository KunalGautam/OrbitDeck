import React, { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Header } from './components/Header.js';
import { MapSettingsModal } from './components/MapSettingsModal.js';
import { MapView } from './components/MapView.js';
import { PassPredictionPanel } from './components/PassPredictionPanel.js';
import { PolarSkyPlot } from './components/PolarSkyPlot.js';
import { RadioPanel } from './components/RadioPanel.js';
import { SatelliteDetailPanel } from './components/SatelliteDetailPanel.js';
import { SatelliteTable } from './components/SatelliteTable.js';
import { StationModal } from './components/StationModal.js';
import { TLEModal } from './components/TLEModal.js';
import { OrbitDeckProvider, useOrbitDeck } from './context/OrbitDeckContext.js';

const MainLayout: React.FC = () => {
  const { viewMode } = useOrbitDeck();
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [isMapSettingsOpen, setIsMapSettingsOpen] = useState(false);
  const [isTLEModalOpen, setIsTLEModalOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-space-900 text-slate-100 overflow-hidden">
      {/* Top Navigation & Mission Clock Bar */}
      <Header
        onOpenStationModal={() => setIsStationModalOpen(true)}
        onOpenMapSettings={() => setIsMapSettingsOpen(true)}
        onOpenTLEModal={() => setIsTLEModalOpen(true)}
      />

      {/* Main Workspace View */}
      <main className="flex-1 overflow-y-auto p-1.5 sm:p-2 min-h-0">
        {viewMode === 'dashboard' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2 min-h-full lg:h-full">
            {/* Left 7 Columns: 2D/3D Map & Satellite List */}
            <div className="lg:col-span-7 flex flex-col gap-2 min-h-0 lg:h-full">
              {/* Map */}
              <div className="h-[280px] sm:h-[360px] lg:h-[58%] min-h-[180px] flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden border border-space-700 shadow-xl">
                <ErrorBoundary fallbackTitle="Map Engine Error">
                  <MapView />
                </ErrorBoundary>
              </div>
              {/* Satellite Table */}
              <div className="h-[260px] sm:h-[320px] lg:h-[42%] min-h-[160px] flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden shadow-xl">
                <SatelliteTable />
              </div>
            </div>

            {/* Right 5 Columns: Polar Radar & Telemetry Detail */}
            <div className="lg:col-span-5 flex flex-col gap-2 min-h-0 lg:h-full">
              {/* Polar Plot */}
              <div className="h-[250px] sm:h-[300px] lg:h-[45%] min-h-[160px] flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden shadow-xl">
                <PolarSkyPlot />
              </div>
              {/* Telemetry Detail */}
              <div className="min-h-[220px] lg:h-[55%] flex-1 lg:flex-initial rounded-lg overflow-hidden shadow-xl">
                <SatelliteDetailPanel />
              </div>
            </div>
          </div>
        )}

        {viewMode === 'map' && (
          <div className="h-full min-h-[450px] rounded-lg overflow-hidden border border-space-700 shadow-xl">
            <ErrorBoundary fallbackTitle="Map Engine Error">
              <MapView />
            </ErrorBoundary>
          </div>
        )}

        {viewMode === 'polar' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2 min-h-full lg:h-full">
            <div className="lg:col-span-7 h-[320px] sm:h-[420px] lg:h-full min-h-[200px] flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden shadow-xl">
              <PolarSkyPlot />
            </div>
            <div className="lg:col-span-5 min-h-[240px] lg:h-full flex-shrink-0 lg:flex-shrink rounded-lg overflow-hidden shadow-xl">
              <SatelliteDetailPanel />
            </div>
          </div>
        )}

        {viewMode === 'details' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2 min-h-full lg:h-full">
            <div className="lg:col-span-6 min-h-[420px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <SatelliteDetailPanel />
            </div>
            <div className="lg:col-span-6 min-h-[380px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <SatelliteTable />
            </div>
          </div>
        )}

        {viewMode === 'passes' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2 min-h-full lg:h-full">
            <div className="lg:col-span-8 min-h-[420px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <PassPredictionPanel />
            </div>
            <div className="lg:col-span-4 h-[350px] sm:h-[420px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <PolarSkyPlot />
            </div>
          </div>
        )}

        {viewMode === 'radio' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-2 min-h-full lg:h-full">
            <div className="lg:col-span-7 min-h-[420px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <RadioPanel />
            </div>
            <div className="lg:col-span-5 min-h-[380px] lg:h-full flex-shrink-0 lg:flex-shrink">
              <SatelliteDetailPanel />
            </div>
          </div>
        )}
      </main>

      {/* Modals with Portals & High Z-Index */}
      <StationModal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} />
      <MapSettingsModal isOpen={isMapSettingsOpen} onClose={() => setIsMapSettingsOpen(false)} />
      <TLEModal isOpen={isTLEModalOpen} onClose={() => setIsTLEModalOpen(false)} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary fallbackTitle="OrbitDeck System Error">
      <OrbitDeckProvider>
        <MainLayout />
      </OrbitDeckProvider>
    </ErrorBoundary>
  );
};

export default App;
