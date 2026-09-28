import React, { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import { useOrbitDeck } from '../context/OrbitDeckContext.js';

export const PolarSkyPlot: React.FC = () => {
  const { selectedSatellite, selectedFrame, activeStation, activePasses, celestial } =
    useOrbitDeck();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Find current or next upcoming pass for selected satellite
  const now = Date.now();
  const targetPass = activePasses.find((p) => p.losTime >= now) || activePasses[0] || null;

  // Track container dimensions responsively for both width and height
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setSize({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          setSize({ width: Math.floor(width), height: Math.floor(height) });
        }
      });
      observer.observe(container);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const containerWidth = Math.floor(rect.width);
    const containerHeight = Math.floor(rect.height);

    if (containerWidth <= 0 || containerHeight <= 0) return;

    // Responsive square diameter that strictly obeys BOTH available width AND height
    const diameter = Math.max(60, Math.floor(Math.min(containerWidth, containerHeight)));
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    canvas.width = diameter * dpr;
    canvas.height = diameter * dpr;
    canvas.style.width = `${diameter}px`;
    canvas.style.height = `${diameter}px`;

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    const width = diameter;
    const height = diameter;
    const cx = width / 2;
    const cy = height / 2;

    const isCompact = diameter < 250;
    const isUltraCompact = diameter < 180;

    const margin = isUltraCompact ? 14 : isCompact ? 18 : 26;
    const maxR = Math.max(12, diameter / 2 - margin);

    // Clear background
    ctx.clearRect(0, 0, width, height);

    // Draw Polar Radar Background
    ctx.fillStyle = '#080c16';
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, 2 * Math.PI);
    ctx.fill();

    // Elevation rings: 0° (horizon), 30°, 60°
    const elevations = isUltraCompact ? [0, 45] : [0, 30, 60];
    ctx.strokeStyle = '#1b2640';
    ctx.lineWidth = 1;

    for (const el of elevations) {
      const r = maxR * ((90 - el) / 90);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.stroke();

      // Elevation label
      ctx.fillStyle = '#64748b';
      ctx.font = isUltraCompact ? '7px monospace' : isCompact ? '8px monospace' : '10px monospace';
      ctx.fillText(`${el}°`, cx + 3, cy - r + (isCompact ? 9 : 12));
    }

    // Radial spokes (every 30 degrees, highlighted every 90)
    const spokeStep = isUltraCompact ? 90 : 30;
    for (let deg = 0; deg < 360; deg += spokeStep) {
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

    const cardOffset = isUltraCompact ? 8 : isCompact ? 10 : 14;
    ctx.font = isUltraCompact
      ? 'bold 8px monospace'
      : isCompact
        ? 'bold 10px monospace'
        : 'bold 12px monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const card of cardinals) {
      const rad = ((card.deg - 90) * Math.PI) / 180;
      const x = cx + (maxR + cardOffset) * Math.cos(rad);
      const y = cy + (maxR + cardOffset) * Math.sin(rad);
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
      ctx.lineWidth = isCompact ? 1.5 : 2.5;
      ctx.stroke();

      const markerRadius = isCompact ? 3 : 4;

      // AOS Marker (Green)
      const aosPt = targetPass.points[0];
      if (aosPt) {
        const { x, y } = azElToXY(targetPass.aosAzimuthDeg, 0);
        ctx.fillStyle = '#00e676';
        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, 2 * Math.PI);
        ctx.fill();
        if (!isUltraCompact) {
          ctx.font = isCompact ? '8px monospace' : '10px monospace';
          ctx.fillText('AOS', x, y - (isCompact ? 6 : 8));
        }
      }

      // LOS Marker (Red)
      const losPt = targetPass.points[targetPass.points.length - 1];
      if (losPt) {
        const { x, y } = azElToXY(targetPass.losAzimuthDeg, 0);
        ctx.fillStyle = '#ff1744';
        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, 2 * Math.PI);
        ctx.fill();
        if (!isUltraCompact) {
          ctx.font = isCompact ? '8px monospace' : '10px monospace';
          ctx.fillText('LOS', x, y - (isCompact ? 6 : 8));
        }
      }

      // Max Elevation Peak Marker
      const maxElPt = azElToXY(
        targetPass.points[Math.floor(targetPass.points.length / 2)]?.azimuthDeg || 0,
        targetPass.maxElevationDeg,
      );
      ctx.fillStyle = '#ffab00';
      ctx.beginPath();
      ctx.arc(maxElPt.x, maxElPt.y, markerRadius, 0, 2 * Math.PI);
      ctx.fill();
      if (!isUltraCompact) {
        ctx.font = isCompact ? 'bold 8px monospace' : 'bold 9px monospace';
        ctx.fillText(`${targetPass.maxElevationDeg}°`, maxElPt.x, maxElPt.y - (isCompact ? 6 : 8));
      }
    }

    // Draw Sun and Moon positions
    for (const body of celestial) {
      if (body.azimuthDeg !== undefined && body.elevationDeg !== undefined) {
        if (body.elevationDeg > -10) {
          const { x, y } = azElToXY(body.azimuthDeg, Math.max(0, body.elevationDeg));
          ctx.font = isUltraCompact
            ? '10px monospace'
            : isCompact
              ? '12px monospace'
              : '16px monospace';
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
        ctx.arc(x, y, isCompact ? 6 : 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, isCompact ? 3 : 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#00e5ff';
        ctx.fill();

        if (!isUltraCompact) {
          ctx.font = isCompact ? 'bold 8px monospace' : 'bold 10px monospace';
          ctx.fillStyle = '#fff';
          ctx.fillText(selectedFrame.name, x, y + (isCompact ? 10 : 14));
        }
      }
    }
  }, [targetPass, selectedFrame, celestial, size]);

  return (
    <div className="w-full h-full bg-space-850 p-2 sm:p-3 flex flex-col min-h-0 overflow-hidden select-none">
      {/* Header Info */}
      <div className="w-full flex items-center justify-between text-[11px] sm:text-xs text-slate-300 border-b border-space-700 pb-1.5 flex-shrink-0">
        <div className="flex items-center space-x-1.5 truncate pr-2 min-w-0">
          <Compass className="w-3.5 h-3.5 text-orbit-cyan flex-shrink-0" />
          <span className="font-bold text-slate-100 whitespace-nowrap">POLAR SKY PLOT</span>
          <span className="text-slate-400 truncate hidden xs:inline">
            • {selectedSatellite?.name || 'No satellite selected'}
          </span>
        </div>
        <div className="text-[10px] sm:text-[11px] text-slate-400 flex-shrink-0 whitespace-nowrap">
          QTH: <span className="text-orbit-green font-bold">{activeStation?.name || 'None'}</span>
          {activeStation?.maidenhead && ` (${activeStation.maidenhead})`}
        </div>
      </div>

      {/* Canvas Radar Chart Container - Flexes responsively to width AND height */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden my-1"
      >
        <canvas ref={canvasRef} className="block" />
      </div>

      {/* Target Pass Summary & Live Values - Stays fixed at bottom without overlapping */}
      <div className="w-full bg-space-800/80 border border-space-700 rounded-lg p-1.5 sm:p-2 text-[10px] sm:text-xs grid grid-cols-2 sm:grid-cols-4 gap-1.5 flex-shrink-0">
        <div className="min-w-0">
          <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">
            CURRENT AZ / EL
          </span>
          <span className="font-bold font-mono text-slate-100 text-[10px] sm:text-xs truncate block">
            {selectedFrame?.azimuthDeg !== undefined
              ? `${selectedFrame.azimuthDeg}° / ${selectedFrame.elevationDeg}°`
              : 'N/A'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">
            MAX ELEVATION
          </span>
          <span className="font-bold font-mono text-orbit-amber text-[10px] sm:text-xs truncate block">
            {targetPass ? `${targetPass.maxElevationDeg}°` : 'None in range'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">
            AOS AZ / TIME
          </span>
          <span className="font-bold font-mono text-orbit-green text-[10px] sm:text-xs truncate block">
            {targetPass
              ? `${targetPass.aosAzimuthDeg}° @ ${new Date(targetPass.aosTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'N/A'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[9px] sm:text-[10px] truncate">
            VISIBILITY
          </span>
          <span className="font-bold font-mono capitalize text-orbit-cyan text-[10px] sm:text-xs truncate block">
            {targetPass?.visibility || 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};
