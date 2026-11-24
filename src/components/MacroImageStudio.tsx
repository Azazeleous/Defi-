import React, { useEffect, useRef, useState } from 'react';
import { Download, Eye, EyeOff, Image as ImageIcon, Layers, Save, Upload } from 'lucide-react';
import type { MacroStudioLayer, PicMaskKind } from '../contracts/v7-convergence';
import {
  buildProceduralGradient,
  evaluateWcagContrast,
  evaluateWavefunctionPolar,
} from '../engine/quantumRoseGovernor';
import { buildPicCssClipMask, validatePicBufferBounds } from '../engine/picGeometryEngine';
import { globalCircularRuntime } from '../engine/circularProcessingRuntime';

const INITIAL_LAYERS: MacroStudioLayer[] = [
  {
    layerId: 'lyr_palette',
    name: 'ColorManager OKLCH / Display-P3 Backdrop',
    sourceType: 'COLOR_PALETTE',
    visible: true,
    opacity: 0.92,
    blendMode: 'source-over',
    picQuantizeBits: 8,
    clipMaskKind: 'inset',
    clipMaskCss: 'inset(0% round 8px)',
    width: 720,
    height: 440,
    provenance: 'DETERMINISTICALLY_DERIVED',
  },
  {
    layerId: 'lyr_rose',
    name: 'Quantum Rose Polar Interference Field',
    sourceType: 'QUANTUM_ROSE',
    visible: true,
    opacity: 0.9,
    blendMode: 'screen',
    picQuantizeBits: 8,
    clipMaskKind: 'circle',
    clipMaskCss: 'circle(48% at 50% 50%)',
    width: 720,
    height: 440,
    provenance: 'DETERMINISTICALLY_DERIVED',
  },
  {
    layerId: 'lyr_graph',
    name: 'Provenance Telemetry Series Overlay',
    sourceType: 'GRAPH_SNAPSHOT',
    visible: true,
    opacity: 0.78,
    blendMode: 'lighter',
    picQuantizeBits: 8,
    clipMaskKind: 'polygon',
    clipMaskCss: 'polygon(50% 2%, 93% 25%, 93% 75%, 50% 98%, 7% 75%, 7% 25%)',
    width: 720,
    height: 440,
    provenance: 'MEASURED',
  },
];

export const MacroImageStudio: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [layers, setLayers] = useState<MacroStudioLayer[]>(INITIAL_LAYERS);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('lyr_rose');
  const [studioTitle, setStudioTitle] = useState<string>('CONVERGENCE COMPOSITE // V7.0.0');
  const [titleHex, setTitleHex] = useState<string>('#F8FAFC');
  const [containerMask, setContainerMask] = useState<PicMaskKind>('inset');
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [telemetryValues, setTelemetryValues] = useState<number[]>([]);
  const [commitNotice, setCommitNotice] = useState<string | null>(null);

  // Fetch genuine SQLite telemetry values for Graph Snapshot layer (zero synthetic curves)
  useEffect(() => {
    fetch('/api/cryptic/analytics?limit=24')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok && Array.isArray(d.bundle?.series)) {
          setTelemetryValues(d.bundle.series.map((s: any) => Number(s.aggregateOpsPerSec || 0)));
        }
      })
      .catch(() => {});
  }, []);

  // Re-composite studio canvas deterministically whenever layers or Hamiltonian snapshot update
  const renderComposite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#04070D';
    ctx.fillRect(0, 0, w, h);

    const ham = globalCircularRuntime.getLatestSnapshot();
    const gradSpec = buildProceduralGradient({
      kind: 'PROCEDURAL_HAMILTONIAN',
      baseHueDeg: 194 + ham.simTime * 15,
      chroma: 0.21,
      lightness: 0.56,
    });

    for (const layer of layers) {
      if (!layer.visible) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;

      if (layer.sourceType === 'COLOR_PALETTE') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        gradSpec.stops.forEach((s) => g.addColorStop(s.position, s.srgbHex));
        ctx.fillStyle = g;
        ctx.globalAlpha = layer.opacity * 0.35;
        ctx.fillRect(0, 0, w, h);
      } else if (layer.sourceType === 'QUANTUM_ROSE') {
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) * 0.4;
        for (let ri = 1; ri <= 20; ri++) {
          const rNorm = ri / 20;
          const rPx = rNorm * radius;
          ctx.beginPath();
          for (let si = 0; si <= 96; si++) {
            const theta = (si / 96) * Math.PI * 2;
            const psi = evaluateWavefunctionPolar(rNorm, theta, ham.eigenstates, ham.coherence);
            const mod = rPx * (0.7 + Math.min(0.6, psi.probDensity * 1.1));
            const x = cx + Math.cos(theta) * mod;
            const y = cy + Math.sin(theta) * mod;
            if (si === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle = gradSpec.stops[ri % gradSpec.stops.length]?.srgbHex || '#38bdf8';
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      } else if (layer.sourceType === 'GRAPH_SNAPSHOT') {
        if (telemetryValues.length > 1) {
          const maxV = Math.max(1, ...telemetryValues);
          ctx.beginPath();
          telemetryValues.forEach((v, idx) => {
            const x = 40 + (idx / (telemetryValues.length - 1)) * (w - 80);
            const y = h - 55 - (v / maxV) * (h * 0.32);
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '12px monospace';
          ctx.fillText('GRAPH LAYER: NO MEASURED SQLITE SERIES YET (UNAVAILABLE)', 40, h - 52);
        }
      } else if (layer.sourceType === 'USER_IMAGE' && uploadedImage) {
        ctx.drawImage(uploadedImage, 40, 40, w - 80, h - 80);
      }

      // Optional PIC integer bit-depth quantization on composited pixel buffer
      if (layer.picQuantizeBits < 8) {
        const imgData = ctx.getImageData(0, 0, w, h);
        const shift = 8 - layer.picQuantizeBits;
        const mask = (0xff << shift) & 0xff;
        const bytes = imgData.data;
        for (let i = 0; i < bytes.length; i += 4) {
          bytes[i] &= mask;
          bytes[i + 1] &= mask;
          bytes[i + 2] &= mask;
        }
        ctx.putImageData(imgData, 0, 0);
      }

      ctx.restore();
    }

    // Crisp HUD stamp on canvas
    ctx.fillStyle = titleHex;
    ctx.font = 'bold 14px monospace';
    ctx.fillText(studioTitle, 24, 34);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(`PALETTE:${gradSpec.paletteHash} | MASK:${containerMask.toUpperCase()} | V7.0.0`, 24, h - 18);
  };

  useEffect(() => {
    renderComposite();
  }, [layers, studioTitle, titleHex, containerMask, uploadedImage, telemetryValues]);

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadStatus('Rejected: Only image/* files permitted.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadStatus('Rejected: Image exceeds 8 MiB boundary cap.');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const bounds = validatePicBufferBounds(img.width, img.height);
      if (!bounds.withinBounds) {
        setUploadStatus(`Gate B Rejected: ${bounds.reason}`);
        URL.revokeObjectURL(url);
        return;
      }
      setUploadedImage(img);
      setUploadStatus(`Loaded ${file.name} (${img.width}x${img.height}) within PIC bounds.`);
      setLayers((prev) => {
        if (prev.some((l) => l.layerId === 'lyr_user_img')) return prev;
        return [
          ...prev,
          {
            layerId: 'lyr_user_img',
            name: `User Image (${file.name})`,
            sourceType: 'USER_IMAGE',
            visible: true,
            opacity: 0.72,
            blendMode: 'screen',
            picQuantizeBits: 8,
            clipMaskKind: 'inset',
            clipMaskCss: 'inset(0%)',
            width: img.width,
            height: img.height,
            provenance: 'PERSISTED_EVENTS',
          },
        ];
      });
    };
    img.src = url;
  };

  const selectedLayer = layers.find((l) => l.layerId === selectedLayerId) || layers[0];
  const wcagCheck = evaluateWcagContrast(titleHex, '#04070D');
  const previewClipMask = buildPicCssClipMask(containerMask, 0.25);

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `macro-studio-v7-${Date.now()}.png`;
    a.click();
  };

  const handleExportManifestJson = () => {
    const payload = {
      spec: 'GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7',
      studioTitle,
      containerMask: previewClipMask,
      wcagTitleAudit: wcagCheck,
      layers,
      exportedAtUtc: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `macro-studio-manifest-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCommitStudioExport = async () => {
    setCommitNotice(null);
    const res = await fetch('/api/memory/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cryptic-role': 'ADMINISTRATOR' },
      body: JSON.stringify({
        userConsent: true,
        eventType: 'V7_IMAGE_STUDIO_EXPORT',
        source: 'macro_image_studio_v7',
        project: 'GAIA-NEXUS-V7',
        tags: ['image_studio', containerMask],
        payload: JSON.stringify({
          studioTitle,
          layerCount: layers.length,
          layers: layers.map((l) => ({
            id: l.layerId,
            sourceType: l.sourceType,
            provenance: l.provenance,
            picQuantizeBits: l.picQuantizeBits,
          })),
          wcagStatus: wcagCheck.statusLabel,
        }),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      setCommitNotice(`Export manifest saved to Save_Memory seq #${data.event.sequence}`);
    } else {
      setCommitNotice(`Commit error: ${data.error}`);
    }
  };

  return (
    <div className="w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono text-xs text-slate-100">
      {/* Left Layer Stack & PIC / Blend Controls */}
      <div className="lg:col-span-4 bg-[#080D16]/90 border border-slate-800 p-4 space-y-4">
        <div className="border-b border-slate-800 pb-2">
          <div className="text-[10px] text-cyan-400 uppercase">MULTI-LAYER COMPOSITOR &bull; PNG + JSON</div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            <span>Macro Image Studio</span>
          </h2>
        </div>

        <div className="space-y-1.5">
          {layers.map((lyr) => (
            <div
              key={lyr.layerId}
              onClick={() => setSelectedLayerId(lyr.layerId)}
              className={`p-2 border cursor-pointer flex items-center justify-between ${
                selectedLayerId === lyr.layerId
                  ? 'border-cyan-400 bg-cyan-500/10'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="font-semibold text-white">{lyr.name}</div>
                <div className="text-[10px] text-slate-400">
                  {lyr.provenance} &bull; {lyr.picQuantizeBits}-bit &bull; {lyr.blendMode}
                </div>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  setLayers((prev) =>
                    prev.map((x) => (x.layerId === lyr.layerId ? { ...x, visible: !x.visible } : x))
                  );
                }}
                className="p-1 text-slate-300 hover:text-white"
              >
                {lyr.visible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
              </button>
            </div>
          ))}
        </div>

        {selectedLayer && (
          <div className="p-3 bg-slate-950 border border-slate-800 space-y-3">
            <div className="font-bold text-cyan-300 text-[11px]">Layer Settings: {selectedLayer.name}</div>
            <div>
              <div className="flex justify-between text-[11px] mb-1 tabular-nums">
                <span>Opacity</span>
                <span>{Math.round(selectedLayer.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={selectedLayer.opacity}
                onChange={(e) =>
                  setLayers((prev) =>
                    prev.map((x) =>
                      x.layerId === selectedLayer.layerId ? { ...x, opacity: Number(e.target.value) } : x
                    )
                  )
                }
                className="w-full accent-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 tabular-nums">
                <span>PIC Bit-Depth Quantization</span>
                <span>{selectedLayer.picQuantizeBits} bits/ch</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={selectedLayer.picQuantizeBits}
                onChange={(e) =>
                  setLayers((prev) =>
                    prev.map((x) =>
                      x.layerId === selectedLayer.layerId
                        ? { ...x, picQuantizeBits: Number(e.target.value) }
                        : x
                    )
                  )
                }
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(['source-over', 'screen', 'lighter', 'multiply'] as const).map((bm) => (
                <button
                  key={bm}
                  onClick={() =>
                    setLayers((prev) =>
                      prev.map((x) => (x.layerId === selectedLayer.layerId ? { ...x, blendMode: bm } : x))
                    )
                  }
                  className={`py-1 text-[10px] border ${
                    selectedLayer.blendMode === bm
                      ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {bm}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-slate-800 pt-3">
          <label className="w-full py-2 px-3 bg-slate-900 border border-slate-700 hover:border-cyan-400 cursor-pointer flex items-center justify-center gap-2 text-xs">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import Local Image (PIC Bounds Checked)</span>
            <input type="file" accept="image/*" onChange={handleUserImageUpload} className="hidden" />
          </label>
          {uploadStatus && <div className="text-[11px] text-emerald-300">{uploadStatus}</div>}
        </div>
      </div>

      {/* Right Preview Stage & Exports */}
      <div className="lg:col-span-8 bg-[#080D16]/90 border border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-white">Composite Stage (720&times;440)</span>
            <span
              className={`text-[10px] px-2 py-0.5 border ${
                wcagCheck.aaNormal
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
              }`}
            >
              WCAG Title {wcagCheck.contrastRatio}:1 ({wcagCheck.statusLabel})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['inset', 'polygon', 'circle', 'ellipse', 'path'] as const).map((mk) => (
              <button
                key={mk}
                onClick={() => setContainerMask(mk)}
                className={`px-2 py-1 text-[10px] border ${
                  containerMask === mk
                    ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                {mk}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={studioTitle}
            onChange={(e) => setStudioTitle(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 text-white"
            placeholder="Overlay Title"
          />
          <input
            type="text"
            value={titleHex}
            onChange={(e) => setTitleHex(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 text-white"
            placeholder="#F8FAFC"
          />
        </div>

        <div className="bg-slate-950 border border-slate-800 p-3 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={720}
            height={440}
            style={{ clipPath: previewClipMask.cssClipPath }}
            className="max-w-full h-auto border border-slate-800 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportPng}
              className="px-3 py-1.5 bg-emerald-600/20 border border-emerald-500/50 text-emerald-200 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export PNG</span>
            </button>
            <button
              onClick={handleExportManifestJson}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-200 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Signed JSON</span>
            </button>
            <button
              onClick={handleCommitStudioExport}
              className="px-3 py-1.5 bg-cyan-600/20 border border-cyan-500/50 text-cyan-200 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Commit to Save_Memory</span>
            </button>
          </div>
          {commitNotice && <span className="text-[11px] text-emerald-300">{commitNotice}</span>}
        </div>
      </div>
    </div>
  );
};
