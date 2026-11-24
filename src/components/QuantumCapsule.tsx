import React, { useEffect, useRef, useState, useCallback } from 'react';
import { evaluateChernCurvature } from '../workers/matrixWorker';
import { Sparkles, Activity, Layers, Zap, Radio } from 'lucide-react';

interface GhostParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface PipelineStep {
  id: string;
  stepOrderPlan: string;
  hue: number;
  percentile: number;
  positionInline: number;
  hardwareLayer: string;
  timestamp: number;
}

interface Props {
  onPipelineUpdate?: (queue: PipelineStep[]) => void;
  onDeltaEmitted?: (delta: any) => void;
}

export const QuantumCapsule: React.FC<Props> = ({ onPipelineUpdate, onDeltaEmitted }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // WebGL & worker references
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const bufferRef = useRef<WebGLBuffer | null>(null);
  const hueLocRef = useRef<WebGLUniformLocation | null>(null);
  const ghostParticlesRef = useRef<GhostParticle[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  // Reactive state
  const [inlayPadding, setInlayPadding] = useState<number>(12.5);
  const [currentHue, setCurrentHue] = useState<number>(180);
  const [currentStepPlan, setCurrentStepPlan] = useState<string>('STEP_01_INITIAL_INGEST_PIPELINE');
  const [latestPercentile, setLatestPercentile] = useState<string>('50.00');
  const [chernValue, setChernValue] = useState<number>(1.042);
  const [activeGhostCount, setActiveGhostCount] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'>('DISCONNECTED');
  const [interactionCount, setInteractionCount] = useState<number>(0);

  // 1. Burst Ghost Tracers
  const burstGhostTracers = useCallback((xc: number, yc: number, w: number, h: number) => {
    const glX = (xc / w) * 2 - 1;
    const glY = -(yc / h) * 2 + 1;

    for (let i = 0; i < 14; i++) {
      ghostParticlesRef.current.push({
        x: glX,
        y: glY,
        vx: (Math.random() - 0.5) * 0.09,
        vy: (Math.random() - 0.5) * 0.09,
        life: 1.0,
      });
    }
  }, []);

  // 2. Process Workflow Evaluation
  const processWorkflowEvaluation = useCallback((telemetry: any) => {
    const percentile = telemetry.score;
    const verifiedHue = Math.floor(percentile * 360);

    let currentTaskStep = 'SEQUENCE_UNKNOWN';
    if (verifiedHue >= 0 && verifiedHue < 120) {
      currentTaskStep = 'STEP_01_INITIAL_INGEST_PIPELINE';
    } else if (verifiedHue >= 120 && verifiedHue < 240) {
      currentTaskStep = 'STEP_02_RESONANCE_BALANCING';
    } else {
      currentTaskStep = 'STEP_03_EQUILIBRIUM_LOCK_COMMIT';
    }

    const structuralPadding = 12.5 + percentile * 15;
    setInlayPadding(structuralPadding);
    setCurrentHue(verifiedHue);
    setCurrentStepPlan(currentTaskStep);
    setLatestPercentile((percentile * 100).toFixed(2));
    if (telemetry.chernCurvature) setChernValue(telemetry.chernCurvature);

    const deltaDetail = {
      stepOrderPlan: currentTaskStep,
      assignedHue: verifiedHue,
      matchingPercentile: (percentile * 100).toFixed(2),
      hardwareLayer: telemetry.quantumSimulationMode || 'CHER_CURVATURE_MATHEMATICA_LAYERED',
    };

    if (onDeltaEmitted) onDeltaEmitted(deltaDetail);

    // Forward to WebSocket server if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'WORKFLOW_AUTOMATION_DELTA',
          detail: deltaDetail,
        })
      );
    }
  }, [onDeltaEmitted]);

  // 3. Connect to Tuning Fork WebSocket
  useEffect(() => {
    let active = true;

    const connectToTuningFork = () => {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;

      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (!active) return;
          setWsStatus('CONNECTED');
        };

        socket.onmessage = (event) => {
          if (!active) return;
          try {
            const serverPayload = JSON.parse(event.data);
            if (serverPayload.type === 'PIPELINE_RESTRUCTURED') {
              if (onPipelineUpdate) onPipelineUpdate(serverPayload.queue);

              // Apply structural feedback
              const queue: PipelineStep[] = serverPayload.queue || [];
              const myPos = queue.findIndex(
                (s) => s.hardwareLayer === 'CHER_CURVATURE_MATHEMATICA_LAYERED'
              );
              if (myPos !== -1 && queue.length > 0) {
                const positionFactor = myPos / queue.length;
                const newHue = positionFactor * 360;
                setCurrentHue(newHue);
                if (glRef.current && hueLocRef.current) {
                  glRef.current.useProgram(programRef.current);
                  glRef.current.uniform1f(hueLocRef.current, newHue);
                }
              }
            }
          } catch (e) {
            console.error('Error parsing WS frame:', e);
          }
        };

        socket.onerror = () => {
          if (!active) return;
          setWsStatus('RECONNECTING');
        };

        socket.onclose = () => {
          if (!active) return;
          setWsStatus('RECONNECTING');
          setTimeout(connectToTuningFork, 3000);
        };
      } catch {
        setWsStatus('DISCONNECTED');
      }
    };

    connectToTuningFork();

    return () => {
      active = false;
      if (socketRef.current) socketRef.current.close();
    };
  }, [onPipelineUpdate]);

  // 4. Initialize WebGL & Matrix Worker
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;
    glRef.current = gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute float a_type; // 0.0 = Continuum Node, 1.0 = Ghost Tracer
      varying float v_type;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = (a_type > 0.5) ? 3.5 : 7.5;
        v_type = a_type;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying float v_type;
      uniform float u_hue;
      void main() {
        if (v_type > 0.5) {
          // Ghost tracers dissipate into deep void states
          gl_FragColor = vec4(0.0, 1.0, 0.8, 0.6);
        } else {
          // Map structural hue directly from automated pipeline validation
          float h = u_hue / 360.0;
          gl_FragColor = vec4(h, 1.0 - h, 0.5 + (h * 0.5), 1.0);
        }
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    programRef.current = program;

    bufferRef.current = gl.createBuffer();
    hueLocRef.current = gl.getUniformLocation(program, 'u_hue');

    // Matrix worker
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL('../workers/matrixWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (e) => {
        if (e.data.type === 'VALIDATION_COMPLETE') {
          processWorkflowEvaluation(e.data.payload);
        }
      };
      workerRef.current = worker;
    } catch {
      workerRef.current = null;
    }

    // Animation Render Loop
    let animId: number;
    const renderLoop = () => {
      // 1. Update tracers
      const particles = ghostParticlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.025;
        if (p.life <= 0) particles.splice(i, 1);
      }
      setActiveGhostCount(particles.length);

      // 2. Draw WebGL Frame
      gl.clearColor(0.012, 0.012, 0.014, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);

      if (hueLocRef.current) {
        gl.uniform1f(hueLocRef.current, currentHue);
      }

      // Compile active points array (64 nodes + dynamic active ghost tracers)
      const points: number[] = [];
      for (let i = 0; i < 64; i++) {
        const nx = (i / 63) * 2 - 1;
        // Wave curvature distribution
        const ny = Math.sin((i / 63) * Math.PI * 4 + Date.now() * 0.002) * 0.15;
        points.push(nx, ny, 0.0);
      }
      for (const p of particles) {
        points.push(p.x, p.y, 1.0);
      }

      const vertexData = new Float32Array(points);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufferRef.current);
      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 12, 0);

      const typeLoc = gl.getAttribLocation(program, 'a_type');
      gl.enableVertexAttribArray(typeLoc);
      gl.vertexAttribPointer(typeLoc, 1, gl.FLOAT, false, 12, 8);

      gl.drawArrays(gl.POINTS, 0, points.length / 3);

      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      if (worker) worker.terminate();
    };
  }, [processWorkflowEvaluation, currentHue]);

  // Resize canvas handler
  const handleResize = useCallback(() => {
    if (!canvasRef.current || !glRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasRef.current.width = rect.width * dpr;
    canvasRef.current.height = rect.height * dpr;
    glRef.current.viewport(0, 0, canvasRef.current.width, canvasRef.current.height);
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize, inlayPadding]);

  // Intercept mouse activity to trigger direct synchronous validation loop
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const totalNodes = 64;
    const targetNodeIndex = Math.floor((clickX / rect.width) * totalNodes);

    const payload = {
      nodeIndex: targetNodeIndex,
      p: 1.0,
      dx: e.movementX || 0.01,
      dy: e.movementY || 0.01,
      xc: clickX,
      yc: clickY,
      prs: 0.01,
    };

    burstGhostTracers(clickX, clickY, rect.width, rect.height);
    setInteractionCount((prev) => prev + 1);

    if (workerRef.current) {
      workerRef.current.postMessage({
        type: 'VALIDATE_NODE_NODE',
        payload: payload,
      });
    } else {
      // Fallback
      const result = evaluateChernCurvature(payload);
      processWorkflowEvaluation(result);
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex flex-col justify-between"
      style={{
        padding: `${inlayPadding}px`,
        transition: 'padding 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div className="relative w-full h-full bg-[#030303] border border-[#1a1a1a] rounded-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Top Capsule HUD Ribbon */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[11px] font-mono text-[#00f0ff] uppercase shadow-lg select-none">
          <Sparkles className="w-3.5 h-3.5 text-[#00f0ff] animate-pulse" />
          <span>QUANTUM DATA CAPSULE &bull; &Theta;_(L,h) = -&part;&part;&#772; log h</span>
        </div>

        {/* Top-Right WebSocket Status */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-[#060a10]/95 backdrop-blur border border-[#101d2a] px-3 py-1.5 rounded text-[10px] font-mono select-none">
          <Radio
            className={`w-3.5 h-3.5 ${
              wsStatus === 'CONNECTED' ? 'text-[#39ff14] animate-pulse' : 'text-[#ff0055]'
            }`}
          />
          <span className="text-gray-400">TUNING FORK:</span>
          <span
            className={
              wsStatus === 'CONNECTED'
                ? 'text-[#39ff14] font-bold'
                : 'text-[#ff0055] font-bold'
            }
          >
            {wsStatus}
          </span>
        </div>

        {/* WebGL Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          className="w-full h-full flex-1 block cursor-crosshair select-none"
        />

        {/* Bottom Interaction & Telemetry Bar */}
        <div className="bg-[#050507] border-t border-[#1a1a1a] p-3 text-[11px] font-mono grid grid-cols-2 sm:grid-cols-4 gap-3 z-20 select-none">
          <div>
            <span className="text-gray-500 block text-[9px]">Chern Curvature &Theta;_(L,h):</span>
            <span className="text-[#00f0ff] font-bold">{chernValue.toFixed(4)} rad/m²</span>
          </div>

          <div>
            <span className="text-gray-500 block text-[9px]">Verified Hue / Percentile:</span>
            <span className="text-[#ffb700] font-bold">
              {currentHue}° &bull; {latestPercentile}%
            </span>
          </div>

          <div>
            <span className="text-gray-500 block text-[9px]">Task Order Plan:</span>
            <span className="text-[#39ff14] font-bold truncate block">
              {currentStepPlan}
            </span>
          </div>

          <div>
            <span className="text-gray-500 block text-[9px]">Ghost Tracers / Clicks:</span>
            <span className="text-[#a855f7] font-bold">
              {activeGhostCount} active &bull; {interactionCount} triggers
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
