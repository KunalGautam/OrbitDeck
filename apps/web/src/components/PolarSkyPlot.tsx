import React, { useEffect, useRef } from 'react';
import { Compass } from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

export const PolarSkyPlot: React.FC = () => {
  const { selectedSatellite, selectedFrame, activeStation, activePasses, celestial } =
    useOrbitDeck();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Find current or next upcoming pass for selected satellite
  const now = Date.now();
  const targetPass = activePasses.find((p) => p.losTime >= now) || activePasses[0] || null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(cx, cy) - 28;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw Polar Radar Background
    ctx.fillStyle = '#080c16';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, 2 * Math.PI);
    ctx.fill();

    // Elevation rings: 0° (horizon), 30°, 60°
    const elevations = [0, 30, 60];
    ctx.strokeStyle = '#1b2640';
    ctx.lineWidth = 1;

    for (const el of elevations) {
      const r = maxR * ((90 - el) / 90);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      // Elevation label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText(`${el}°`, cx + 4, cy - r + 12);
    }

    // Radial spokes (every 30 degrees, highlighted every 90)
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = ((deg - 90) * Math.PI) / 180;
      const x2 = cx + maxR * Math.cos(rad);
      const y2 = cy + maxR * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = deg % 90 === 0 ? '#263556' : '#131b2e';
      ctx.stroke();
    }

    // Cardinal directions
    const cardinals = [
      { text: 'N', deg: 0 },
      { text: 'E', deg: 90 },
      { text: 'S', deg: 180 },
      { text: 'W', deg: 270 },
    ];

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const card of cardinals) {
      const rad = ((card.deg - 90) * Math.PI) / 180;
      const x = cx + (maxR + 14) * Math.cos(rad);
      const y = cy + (maxR + 14) * Math.sin(rad);
      ctx.fillText(card.text, x, y);
    }

    const azElToXY = (az: number, el: number) => {
      const clampedEl = Math.max(0, Math.min(90, el));
      const r = maxR * ((90 - clampedEl) / 90);
      const rad = ((az - 90) * Math.PI) / 180;
      return {
        x: cx + r * Math.cos(rad),
        y: cy + r * Math.sin(rad),
      };
    };

    // Draw active pass trajectory curve
    if (targetPass && targetPass.points && targetPass.points.length > 0) {
      ctx.beginPath();
      let first = true;

      for (const pt of targetPass.points) {
        if (pt.elevationDeg >= 0) {
          const { x, y } = azElToXY(pt.azimuthDeg, pt.elevationDeg);
          if (first) {
            ctx.moveTo(x, y);
            first = false;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // AOS Marker (Green)
      const aosPt = targetPass.points[0];
      if (aosPt) {
        const { x, y } = azElToXY(targetPass.aosAzimuthDeg, 0);
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillText('AOS', x, y - 8);
      }

      // LOS Marker (Red)
      const losPt = targetPass.points[targetPass.points.length - 1];
      if (losPt) {
        const { x, y } = azElToXY(targetPass.losAzimuthDeg, 0);
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '10px monospace';
        ctx.fillText('LOS', x, y - 8);
      }

      // Max Elevation Peak Marker
      const maxElPt = azElToXY(
        targetPass.points[Math.floor(targetPass.points.length / 2)]?.azimuthDeg || 0,
        targetPass.maxElevationDeg,
      );
      ctx.fillStyle = '#ffab00';
      ctx.beginPath();
      ctx.arc(maxElPt.x, maxElPt.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${targetPass.maxElevationDeg}°`, maxElPt.x, maxElPt.y - 8);
    }

    // Draw Sun and Moon positions
    for (const body of celestial) {
      if (body.azimuthDeg !== undefined && body.elevationDeg !== undefined) {
        if (body.elevationDeg > -10) {
          const { x, y } = azElToXY(body.azimuthDeg, Math.max(0, body.elevationDeg));
          ctx.font = '16px monospace';
          ctx.fillText(body.type === 'sun' ? '☀️' : '🌙', x, y);
        }
      }
    }

    // Draw Live Satellite position if above horizon
    if (
      selectedFrame &&
      selectedFrame.azimuthDeg !== undefined &&
      selectedFrame.elevationDeg !== undefined
    ) {
      if (selectedFrame.elevationDeg >= 0) {
        const { x, y } = azElToXY(selectedFrame.azimuthDeg, selectedFrame.elevationDeg);

        // Pulsing radar blip
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(selectedFrame.name, x, y + 14);
      }
    }
  }, [targetPass, selectedFrame, celestial]);

  return (
    <div className="w-full h-full bg-space-850 p-4 flex flex-col items-center justify-between overflow-hidden">
      {/* Header Info */}
      <div className="w-full flex items-center justify-between text-xs text-slate-300 border-b border-space-700 pb-2">
        <div className="flex items-center space-x-2">
          <Compass className="w-4 h-4 text-orbit-cyan" />
          <span className="font-bold text-slate-100">POLAR SKY PLOT (AZ / EL)</span>
          <span className="text-slate-400">
            • {selectedSatellite?.name || 'No satellite selected'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400">
          QTH: <span className="text-orbit-green font-bold">{activeStation?.name}</span> (
          {activeStation?.maidenhead})
        </div>
      </div>

      {/* Canvas Radar Chart */}
      <div className="relative flex-1 w-full max-w-[420px] aspect-square flex items-center justify-center py-2">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Target Pass Summary & Live Values */}
      <div className="w-full bg-space-800/80 border border-space-700 rounded-lg p-2.5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div>
          <span className="text-slate-400 block text-[10px]">CURRENT AZ / EL</span>
          <span className="font-bold font-mono text-slate-100">
            {selectedFrame?.azimuthDeg !== undefined
              ? `${selectedFrame.azimuthDeg}° / ${selectedFrame.elevationDeg}°`
              : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">MAX ELEVATION</span>
          <span className="font-bold font-mono text-orbit-amber">
            {targetPass ? `${targetPass.maxElevationDeg}°` : 'None in range'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">AOS AZ / TIME</span>
          <span className="font-bold font-mono text-orbit-green">
            {targetPass
              ? `${targetPass.aosAzimuthDeg}° @ ${new Date(targetPass.aosTime).toLocaleTimeString()}`
              : 'N/A'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-[10px]">VISIBILITY</span>
          <span className="font-bold font-mono capitalize text-orbit-cyan">
            {targetPass?.visibility || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};
