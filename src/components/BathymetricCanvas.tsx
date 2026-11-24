import React, { useEffect, useRef, useState } from 'react';
import { CalculusTensorState } from '../types/subsea';
import { Activity, Sliders, Waves, Wind } from 'lucide-react';

interface Props {
  tensorState: CalculusTensorState;
  bathyPoints: number[];
  isHalted: boolean;
  onFrictionChange: (val: number) => void;
}

export const BathymetricCanvas: React.FC<Props> = ({
  tensorState,
  bathyPoints,
  isHalted,
  onFrictionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [friction, setFriction] = useState<number>(tensorState.dynamicFrictionCoeff || 0.042);

  // Render loop for bathymetric profile
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas sizing
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const width = canvas.width;
    const height = canvas.height;
    const t = tensorState.internalTimer;

    // Clear background: deep oceanic abyss #010306
    ctx.fillStyle = '#010306';
    ctx.fillRect(0, 0, width, height);

    // Draw Bathymetric Depth Grid Lines (-2000m, -4000m, -6000m, -8000m, -10000m)
    ctx.strokeStyle = '#0e1924';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const depths = [
      { y: 0.25, label: '-2,500m Continental Slope' },
      { y: 0.45, label: '-5,000m Abyssal Plain' },
      { y: 0.65, label: '-7,500m Fracture Trench' },
      { y: 0.85, label: '-10,000m Hadal Zone' },
    ];

    depths.forEach((d) => {
      const lineY = height * d.y;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();

      ctx.fillStyle = '#1e3a5f';
      ctx.font = '9px monospace';
      ctx.fillText(d.label, 8, lineY - 4);
    });
    ctx.setLineDash([]);

    // Draw Water Column Shading (Gradient from navy surface to black abyss)
    const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
    waterGrad.addColorStop(0, 'rgba(0, 240, 255, 0.04)');
    waterGrad.addColorStop(0.5, 'rgba(0, 50, 100, 0.08)');
    waterGrad.addColorStop(1, 'rgba(1, 3, 6, 0.95)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 0, width, height);

    // Calculate Ocean Floor Bed Contour based on bathyPoints or mathematical parametric function
    const baseY = height * 0.62;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    const pointsCount = Math.max(50, bathyPoints.length);
    for (let i = 0; i < pointsCount; i++) {
      const x = (i / (pointsCount - 1)) * width;
      const pointWave = bathyPoints[i] !== undefined 
        ? bathyPoints[i] 
        : Math.sin(i * 0.15 + t) * 18 + Math.cos(i * 0.38 - t) * 8;

      const y = baseY + pointWave;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill underneath the seabed with dark substrate gradient
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const seabedGrad = ctx.createLinearGradient(0, baseY, 0, height);
    seabedGrad.addColorStop(0, 'rgba(0, 240, 255, 0.12)');
    seabedGrad.addColorStop(1, 'rgba(4, 10, 18, 0.98)');
    ctx.fillStyle = seabedGrad;
    ctx.fill();

    // Render active packet photon traveling along the ocean bed
    const activeX = ((t * 85) % width);
    const activeIdx = Math.floor((activeX / width) * pointsCount);
    const waveOffset = bathyPoints[activeIdx] !== undefined 
      ? bathyPoints[activeIdx] 
      : Math.sin(activeIdx * 0.15 + t) * 18;
    const packetY = baseY + waveOffset;

    // Upward reflecting acoustic echo sonar beam
    const echoBeamGrad = ctx.createLinearGradient(activeX, packetY, activeX, packetY - 70);
    echoBeamGrad.addColorStop(0, 'rgba(57, 255, 20, 0.45)');
    echoBeamGrad.addColorStop(1, 'rgba(57, 255, 20, 0.0)');

    ctx.strokeStyle = echoBeamGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(activeX, packetY);
    ctx.lineTo(activeX, packetY - 75);
    ctx.stroke();

    // Pulsing echo radar rings around packet
    const ringRadius = (t * 20) % 24;
    ctx.strokeStyle = `rgba(57, 255, 20, ${1 - ringRadius / 24})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(activeX, packetY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Active Packet Glowing Core
    ctx.fillStyle = '#39ff14';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(activeX, packetY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    // Draw Trench Fracture Marker
    ctx.fillStyle = '#ff0055';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('▼ SECTOR 4 FRACTURE TRENCH (-5,420m)', width * 0.52, baseY + 45);
  }, [tensorState, bathyPoints, isHalted]);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setFriction(val);
    onFrictionChange(val);
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-[#010306] border-l border-[#101d2a] flex flex-col overflow-hidden">
      {/* Viewport Header Tag */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[11px] font-mono tracking-wider text-[#00f0ff] uppercase">
        <Waves className="w-3.5 h-3.5 text-[#00f0ff]" />
        <span>Bathymetric Cross-Section &amp; Wind Modulators</span>
      </div>

      {/* Top-Right Trench Depth Readout */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-[#060a10]/90 backdrop-blur border border-[#101d2a] px-2.5 py-1 rounded text-[10px] font-mono">
        <span className="text-[#a0aec0]">Depth:</span>
        <span className="text-[#ff0055] font-bold">
          {tensorState.trenchDepthMeters.toLocaleString()} m
        </span>
      </div>

      {/* Main Canvas */}
      <canvas ref={canvasRef} className="w-full h-full flex-1 block" />

      {/* Bottom Mathematica O(h^2) & Frenet-Serret Readout Tray */}
      <div className="bg-[#060a10] border-t border-[#101d2a] p-3 text-[10px] font-mono text-[#b8daf7] grid grid-cols-2 sm:grid-cols-4 gap-2 z-10">
        <div>
          <span className="text-[#a0aec0] block text-[9px]">O(h²) Central Difference Error:</span>
          <span className="text-[#39ff14] font-bold">
            &plusmn;{tensorState.centralDifferenceError.toExponential(2)}
          </span>
        </div>

        <div>
          <span className="text-[#a0aec0] block text-[9px]">Frenet Curvature &kappa; / &tau;:</span>
          <span className="text-[#00f0ff] font-bold">
            &kappa;={tensorState.curvatureKappa} &bull; &tau;={tensorState.torsionTau}
          </span>
        </div>

        <div>
          <span className="text-[#a0aec0] block text-[9px]">Koopman SVD Spectrum (&Sigma;):</span>
          <span className="text-[#ffb700] font-bold">
            [{tensorState.koopmanSingularValues.join(', ')}]
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#a0aec0] text-[9px] flex items-center gap-1">
              <Wind className="w-3 h-3 text-[#00f0ff]" />
              Friction Coeff:
            </span>
            <span className="text-white font-bold">{friction.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.005"
            max="0.120"
            step="0.005"
            value={friction}
            onChange={handleSlider}
            className="w-full accent-[#00f0ff] h-1.5 bg-[#101d2a] rounded cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
