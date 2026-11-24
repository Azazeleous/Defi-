import React, { useEffect, useRef, useState } from 'react';
import {
  Zap,
  Layers,
  Mic,
  MicOff,
  Eye,
  Moon,
  Clock,
  Sparkles,
  BookOpen,
  RotateCcw,
  SplitSquareHorizontal,
  Play,
  Pause,
  BarChart3,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  DreamLogEntry,
  DreamRealm,
  DreamThemeDistributionItem,
} from '../contracts/cryptic-platform';
import { DreamingGrimoireWorkspace } from './DreamingGrimoireWorkspace';
import { MacroImageStudio } from './MacroImageStudio';
import { CosmicGuardianVoidWorkspace } from './CosmicGuardianVoidWorkspace';

export type GenesisSubView = 'xr' | 'chronosphere' | 'split' | 'grimoire' | 'studio' | 'void';

interface Props {
  children?: React.ReactNode;
  onExit?: () => void;
  isMooncakeActive?: boolean;
  onToggleMooncake?: () => void;
  initialSubView?: GenesisSubView;
}

const REALM_META: Record<
  DreamRealm,
  {
    label: string;
    tag: string;
    subtitle: string;
    hueBase: number;
    hueSpan: number;
    rgb: [number, number, number];
    accentText: string;
    activeClass: string;
  }
> = {
  astral: {
    label: 'Astral Echoes',
    tag: 'ASTRAL ECHOES',
    subtitle: 'Violet liminal starfield & harmonic drift',
    hueBase: 268,
    hueSpan: 55,
    rgb: [0.68, 0.35, 1.0],
    accentText: 'text-purple-300',
    activeClass: 'border-purple-500/50 bg-purple-500/15 text-purple-200',
  },
  cyber: {
    label: 'Neon Reminiscence',
    tag: 'NEON REMINISCENCE',
    subtitle: 'High-contrast cyan-magenta synthetic matrix',
    hueBase: 185,
    hueSpan: 110,
    rgb: [0.0, 0.94, 1.0],
    accentText: 'text-cyan-300',
    activeClass: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200',
  },
  abyss: {
    label: 'Deep Abyss',
    tag: 'DEEP ABYSS',
    subtitle: 'Slow pelagic indigo & benthic resonance',
    hueBase: 215,
    hueSpan: 35,
    rgb: [0.22, 0.45, 0.96],
    accentText: 'text-blue-300',
    activeClass: 'border-blue-500/50 bg-blue-500/15 text-blue-200',
  },
  ethereal: {
    label: 'Solitary Solace',
    tag: 'SOLITARY SOLACE',
    subtitle: 'Rose-amber dawn drift & tranquil clarity',
    hueBase: 320,
    hueSpan: 45,
    rgb: [0.96, 0.48, 0.72],
    accentText: 'text-pink-300',
    activeClass: 'border-pink-500/50 bg-pink-500/15 text-pink-200',
  },
};

const ARCHETYPES: ReadonlyArray<{ id: string; label: string; tag: string }> = [
  { id: 'chased', label: 'Being Chased', tag: 'Anxiety / Avoidance' },
  { id: 'falling', label: 'Falling', tag: 'Loss of Control / Support' },
  { id: 'teeth', label: 'Teeth Falling Out', tag: 'Threshold / Renewal' },
  { id: 'snakes', label: 'Snakes', tag: 'Transformation / Intuition' },
  { id: 'flying', label: 'Flying', tag: 'Autonomy / Lucidity' },
  { id: 'naked', label: 'Naked in Public', tag: 'Exposure / Scrutiny' },
];

export const GenesisXrMonolith: React.FC<Props> = ({
  children,
  onExit,
  isMooncakeActive: controlledMooncake,
  onToggleMooncake,
  initialSubView = 'split',
}) => {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dreamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ledgerRef = useRef<HTMLDivElement | null>(null);

  const [ledgerEntries, setLedgerEntries] = useState<string[]>([]);
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [frameCount, setFrameCount] = useState<number>(3);
  const [hudOpacity, setHudOpacity] = useState<number>(1.0);
  const [internalMooncakeActive, setInternalMooncakeActive] = useState<boolean>(false);
  const [subView, setSubView] = useState<GenesisSubView>(initialSubView);

  useEffect(() => {
    setSubView(initialSubView);
  }, [initialSubView]);

  // ONEIROS Chronosphere State
  const [lucidity, setLucidity] = useState<number>(55);
  const [intensity, setIntensity] = useState<number>(48);
  const [chaos, setChaos] = useState<number>(30);
  const [realm, setRealm] = useState<DreamRealm>('astral');
  const [dreamText, setDreamText] = useState<string>('');
  const [selectedArchetypes, setSelectedArchetypes] = useState<string[]>([]);
  const [dreamLogs, setDreamLogs] = useState<DreamLogEntry[]>([]);
  const [distribution, setDistribution] = useState<DreamThemeDistributionItem[]>([]);
  const [latestAnalysis, setLatestAnalysis] = useState<DreamLogEntry | null>(null);
  const [submittingLog, setSubmittingLog] = useState<boolean>(false);
  const [dreamNotice, setDreamNotice] = useState<string | null>(null);

  // Reality Check Interval Timer (default 5 minutes = 300s)
  const [timerSeconds, setTimerSeconds] = useState<number>(300);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [realityAlert, setRealityAlert] = useState<boolean>(false);

  // Dream Companion & REM Pulse
  const [companionLine, setCompanionLine] = useState<string | null>(null);
  const remPulseRef = useRef<number>(0);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  // Live HCCGN Clock Correlation
  const [clockEpochId, setClockEpochId] = useState<string>('initializing');
  const [clockMonotonicNs, setClockMonotonicNs] = useState<string>('0');

  // Keep live ONEIROS modulation values accessible in animation loops without restarting WebGL shaders
  const paramsRef = useRef({ lucidity, intensity, chaos, realm, isMooncakeActive: false });
  const isMooncakeActive = controlledMooncake !== undefined ? controlledMooncake : internalMooncakeActive;
  paramsRef.current = { lucidity, intensity, chaos, realm, isMooncakeActive };

  const logLedger = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const entry = `[${timestamp}] ${msg}`;
    setLedgerEntries((prev) => [...prev.slice(-80), entry]);
  };

  const triggerMooncakeProtocol = () => {
    if (onToggleMooncake) {
      onToggleMooncake();
    } else {
      setInternalMooncakeActive((prev) => !prev);
    }
    logLedger('🥮 [THE MOONCAKE SEAL] The 15th night. The lunar harmonic. The Enclave awakens.');
    logLedger('🌕 [Æ / MOONCAKE] 888.88 SATS allocation synced: 0x71C...433855274_ENCLAVE_ZK');
    logLedger('🏛️ [GRANDPOD] 50-Node Planterranium matrix unified with Chronosphere.');
  };

  const fetchDreamscapeAndClock = async () => {
    try {
      const [drmRes, clkRes] = await Promise.all([
        fetch('/api/dreamscape/logs'),
        fetch('/api/uclk/snapshot'),
      ]);
      if (drmRes.ok) {
        const drmJson = await drmRes.json();
        setDreamLogs(drmJson.logs || []);
        setDistribution(drmJson.distribution || []);
        if (!latestAnalysis && drmJson.logs?.length > 0) {
          setLatestAnalysis(drmJson.logs[0]);
        }
      }
      if (clkRes.ok) {
        const clkJson = await clkRes.json();
        if (clkJson.snapshot) {
          setClockEpochId(clkJson.snapshot.activeEpoch?.epochId || 'initializing');
          setClockMonotonicNs(clkJson.snapshot.currentMonotonicNs || '0');
        }
      }
    } catch {
      // keep existing UI state on transient poll error
    }
  };

  useEffect(() => {
    logLedger('System boot — GENESIS v7 + XR MONOLITH + ONEIROS CHRONOSPHERE');
    logLedger('FRAME 0 initialized [Anchor: 0.0.0.0 Root]');
    logLedger('FRAME 1 active [DeFi + Chronosphere Synchronized]');
    fetchDreamscapeAndClock();
    const iv = setInterval(() => {
      fetch('/api/uclk/snapshot')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.snapshot) {
            setClockEpochId(d.snapshot.activeEpoch?.epochId || 'initializing');
            setClockMonotonicNs(d.snapshot.currentMonotonicNs || '0');
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (ledgerRef.current) {
      ledgerRef.current.scrollTop = ledgerRef.current.scrollHeight;
    }
  }, [ledgerEntries]);

  // Reality Check Countdown Timer
  useEffect(() => {
    if (!timerRunning) return;
    const iv = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          setRealityAlert(true);
          remPulseRef.current = 1.0;
          logLedger('⏰ [ONEIROS] Reality Check triggered — inspect surroundings & epoch anchor.');
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [timerRunning]);

  // Background 2D Canvas Engine (Modulated by ONEIROS Realm + Intensity + Chaos)
  useEffect(() => {
    const bg = bgCanvasRef.current;
    if (!bg) return;
    const ctx = bg.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let drift = 0;

    const handleResize = () => {
      if (bg) {
        bg.width = window.innerWidth;
        bg.height = window.innerHeight;
      }
      if (xrCanvasRef.current) {
        xrCanvasRef.current.width = window.innerWidth;
        xrCanvasRef.current.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const bgLoop = () => {
      const p = paramsRef.current;
      const meta = REALM_META[p.realm];
      const alpha = 0.1 + (p.intensity / 100) * 0.22 + remPulseRef.current * 0.18;

      ctx.fillStyle = 'rgba(2, 4, 10, 0.18)';
      ctx.fillRect(0, 0, bg.width, bg.height);

      drift = (drift + 0.15 + (p.chaos / 100) * 0.45) % 360;
      remPulseRef.current = Math.max(0, remPulseRef.current - 0.02);

      for (let i = 0; i < 4; i++) {
        const speed = 0.00035 + (p.chaos / 100) * 0.0008;
        const t = Date.now() * speed + i * 1.4;
        const x = Math.sin(t) * (bg.width / 3) + bg.width / 2;
        const y = Math.cos(t * 0.72) * (bg.height / 3) + bg.height / 2;

        const hue = p.isMooncakeActive ? 38 + i * 10 : meta.hueBase + ((drift + i * (meta.hueSpan / 3)) % meta.hueSpan);
        const radius = 260 + (p.lucidity / 100) * 140 + remPulseRef.current * 110;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, `hsla(${hue}, 92%, 55%, ${alpha.toFixed(3)})`);
        g.addColorStop(1, 'transparent');

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(bgLoop);
    };

    bgLoop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // WebGL 6D Particle Cloud Engine
  useEffect(() => {
    const xr = xrCanvasRef.current;
    if (!xr) return;
    const gl = xr.getContext('webgl');
    if (!gl) {
      logLedger('WebGL not supported on this context');
      return;
    }

    const vs = `
      attribute vec3 pos;
      attribute vec4 col;
      uniform mat4 proj;
      uniform float ptSize;
      varying vec4 vcol;
      void main(){
        gl_PointSize = ptSize;
        gl_Position = proj * vec4(pos, 1.0);
        vcol = col;
      }
    `;

    const fs = `
      precision mediump float;
      varying vec4 vcol;
      void main(){
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        gl_FragColor = vcol;
      }
    `;

    const compileShader = (src: string, type: number) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vertShader = compileShader(vs, gl.VERTEX_SHADER);
    const fragShader = compileShader(fs, gl.FRAGMENT_SHADER);
    if (!vertShader || !fragShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    const COUNT = 700;
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 4);

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 200;

      col[i * 4] = 0.5;
      col[i * 4 + 1] = 0.6;
      col[i * 4 + 2] = 1.0;
      col[i * 4 + 3] = 0.72;
    }

    const pb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);

    const cb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);

    const aPos = gl.getAttribLocation(program, 'pos');
    gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, pb);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    const aCol = gl.getAttribLocation(program, 'col');
    gl.enableVertexAttribArray(aCol);
    gl.bindBuffer(gl.ARRAY_BUFFER, cb);
    gl.vertexAttribPointer(aCol, 4, gl.FLOAT, false, 0, 0);

    const uProj = gl.getUniformLocation(program, 'proj');
    const uPtSize = gl.getUniformLocation(program, 'ptSize');

    const getProjection = () => {
      const a = xr.width / (xr.height || 1);
      const f = 1 / Math.tan(Math.PI / 8);
      return new Float32Array([
        f / a, 0, 0, 0,
        0, f, 0, 0,
        0, 0, -1, -1,
        0, 0, -0.2, 0,
      ]);
    };

    let animId: number;
    const xrLoop = () => {
      const now = Date.now();
      const p = paramsRef.current;
      const meta = REALM_META[p.realm];
      const speedMul = 0.4 + (p.chaos / 100) * 2.2 + remPulseRef.current * 2.5;
      const [rBase, gBase, bBase] = meta.rgb;

      for (let i = 0; i < COUNT; i++) {
        const k = i * 3;
        pos[k] += Math.sin(now * 0.0004 * speedMul + i) * 0.032 * speedMul;
        pos[k + 1] += Math.cos(now * 0.0003 * speedMul + i) * 0.032 * speedMul;
        pos[k + 2] += Math.sin(now * 0.0002 * speedMul + i) * 0.032 * speedMul;

        if (p.isMooncakeActive) {
          col[i * 4] = 1.0;
          col[i * 4 + 1] = 0.72 + Math.sin(now * 0.002 + i) * 0.2;
          col[i * 4 + 2] = 0.1;
          col[i * 4 + 3] = 0.9;
        } else {
          const shimmer = 0.75 + 0.25 * Math.sin(now * 0.0012 + i * 0.5);
          col[i * 4] = rBase * shimmer;
          col[i * 4 + 1] = gBase * shimmer;
          col[i * 4 + 2] = bBase;
          col[i * 4 + 3] = 0.38 + (p.intensity / 100) * 0.55;
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, pb);
      gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, cb);
      gl.bufferData(gl.ARRAY_BUFFER, col, gl.DYNAMIC_DRAW);

      gl.viewport(0, 0, xr.width, xr.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform1f(uPtSize, 3.0 + (p.lucidity / 100) * 3.0 + remPulseRef.current * 2.0);
      gl.uniformMatrix4fv(uProj, false, getProjection());
      gl.drawArrays(gl.POINTS, 0, COUNT);

      animId = requestAnimationFrame(xrLoop);
    };

    xrLoop();
    logLedger('XR WebGL GPU particle cloud online (700 6D nodes bound to Chronosphere)');

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [frameCount]);

  // Interactive 2D Chronosphere Dream Canvas (inside ONEIROS panel)
  useEffect(() => {
    if (subView === 'xr') return;
    const canvas = dreamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width);
        canvas.height = Math.floor(rect.height);
      }
    };
    resize();
    window.addEventListener('resize', resize);

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      phase: number;
    }

    const nodes: Node[] = Array.from({ length: 68 }, () => ({
      x: Math.random() * (canvas.width || 600),
      y: Math.random() * (canvas.height || 380),
      vx: (Math.random() - 0.5) * 1.1,
      vy: (Math.random() - 0.5) * 1.1,
      r: 1.5 + Math.random() * 2.6,
      phase: Math.random() * Math.PI * 2,
    }));

    let animId: number;
    const loop = () => {
      const w = canvas.width || 600;
      const h = canvas.height || 380;
      const p = paramsRef.current;
      const meta = REALM_META[p.realm];

      ctx.fillStyle = `rgba(5, 7, 15, ${0.22 - (p.intensity / 100) * 0.1})`;
      ctx.fillRect(0, 0, w, h);

      const speedBoost = 0.5 + (p.chaos / 100) * 2.2 + remPulseRef.current * 2.5;
      const linkDist = 75 + (p.lucidity / 100) * 65;

      // Subtle concentric Chronosphere orbital rings
      const cx = w / 2;
      const cy = h / 2;
      ctx.strokeStyle = `hsla(${meta.hueBase}, 80%, 60%, ${0.08 + (p.lucidity / 100) * 0.14})`;
      ctx.lineWidth = 1;
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, ring * (Math.min(w, h) * 0.14) + Math.sin(Date.now() * 0.001 + ring) * 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.phase += 0.02 * speedBoost;
        n.x += n.vx * speedBoost + Math.cos(n.phase) * (p.chaos / 100) * 0.8;
        n.y += n.vy * speedBoost + Math.sin(n.phase) * (p.chaos / 100) * 0.8;

        if (pointerRef.current.active) {
          const dx = pointerRef.current.x - n.x;
          const dy = pointerRef.current.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < 160 && d > 1) {
            n.vx += (dx / d) * 0.06;
            n.vy += (dy / d) * 0.06;
          }
        }

        // Damp velocity
        n.vx *= 0.992;
        n.vy *= 0.992;
        if (n.x < 0) n.x = w;
        if (n.x > w) n.x = 0;
        if (n.y < 0) n.y = h;
        if (n.y > h) n.y = 0;

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dist = Math.hypot(n.x - m.x, n.y - m.y);
          if (dist < linkDist) {
            const lineAlpha = (1 - dist / linkDist) * (0.2 + (p.intensity / 100) * 0.4);
            ctx.strokeStyle = `hsla(${meta.hueBase + ((i * 7) % meta.hueSpan)}, 90%, 65%, ${lineAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = `hsla(${meta.hueBase + ((i * 11) % meta.hueSpan)}, 95%, 72%, 0.85)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (remPulseRef.current * 2.2), 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [subView]);

  // Voice recognition listener
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;

      rec.onstart = () => {
        setIsVoiceActive(true);
        logLedger('Voice listener active');
      };
      rec.onresult = (e: any) => {
        const text = e.results[e.results.length - 1][0].transcript.toLowerCase();
        setVoiceTranscript(text);
        logLedger(`VOICE DETECTED: "${text}"`);
        if (text.includes('frame')) {
          setFrameCount((prev) => prev + 1);
        }
        if (text.includes('mooncake') || text.includes('moon')) {
          triggerMooncakeProtocol();
        }
      };
      rec.onerror = () => setIsVoiceActive(false);
      rec.onend = () => setIsVoiceActive(false);
      rec.start();

      return () => {
        try {
          rec.stop();
        } catch {}
      };
    } catch {
      // ignore unsupported sandbox errors
    }
  }, []);

  const toggleArchetype = (id: string) => {
    setSelectedArchetypes((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAnalyzeDream = async () => {
    setSubmittingLog(true);
    setDreamNotice(null);
    try {
      const res = await fetch('/api/dreamscape/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cryptic-role': 'OPERATOR',
        },
        body: JSON.stringify({
          dreamText,
          archetypes: selectedArchetypes,
          lucidity,
          intensity,
          chaos,
          realm,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setDreamNotice(json.error || 'Failed to persist dream log.');
      } else {
        setLatestAnalysis(json.entry);
        setDreamLogs(json.logs || []);
        setDistribution(json.distribution || []);
        setDreamText('');
        setSelectedArchetypes([]);
        remPulseRef.current = 0.8;
        logLedger(`🌙 [ONEIROS] Dream log ${json.entry.logId} persisted to SQLite (Epoch ${json.entry.clockEpochId})`);
      }
    } catch (err: any) {
      setDreamNotice(err.message);
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleTapCompanion = () => {
    const quotes = [
      `Mew... Epoch ${clockEpochId} coherent at ${lucidity}% lucidity.`,
      `Realm ${REALM_META[realm].label} attuned. Watch your waking hands.`,
      `Chronosphere telemetry anchored at ${clockMonotonicNs.slice(-9)} ns.`,
      'Subconscious chaos balanced. Breath steady inside the monolith.',
    ];
    const line = quotes[Math.floor(Math.random() * quotes.length)];
    setCompanionLine(line);
    remPulseRef.current = 0.65;
    setTimeout(() => setCompanionLine(null), 3500);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const realmInfo = REALM_META[realm];

  return (
    <div className="relative w-full min-h-[calc(100vh-65px)] bg-[#040404] text-[#00f0ff] font-mono overflow-hidden select-none">
      {/* Background Radial Vis Canvas */}
      <canvas
        id="bg"
        ref={bgCanvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 opacity-45 blur-[10px]"
      />

      {/* XR WebGL Particle Cloud Canvas */}
      <canvas
        id="xr"
        ref={xrCanvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-0"
      />

      {/* Top Header Bar */}
      <div className="relative z-20 w-full px-5 py-3 bg-gradient-to-b from-black via-black/85 to-transparent flex flex-wrap items-center justify-between gap-3 border-b border-[#00f0ff]/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] shadow-[0_0_15px_rgba(0,255,255,0.4)]">
            <Zap className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white text-xs sm:text-sm tracking-[2px]">
                GENESIS v7 + XR MONOLITH &bull; ONEIROS CHRONOSPHERE
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold">
                ANCHOR: 0.0.0.0
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold">
                EPOCH: {clockEpochId}
              </span>
            </div>
            <p className="text-[10px] text-gray-400">
              6D WebGL Particle Space &bull; HCCGN Monotonic Chronosphere &bull; SQLite Cognitive Journal &bull; DeFi Anchor
            </p>
          </div>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-black/70 border border-gray-800 rounded-lg p-0.5 text-[11px]">
            <button
              onClick={() => setSubView('split')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'split'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <SplitSquareHorizontal className="w-3 h-3" />
              <span>Dual Monolith</span>
            </button>
            <button
              onClick={() => setSubView('chronosphere')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'chronosphere'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span>ONEIROS Journal</span>
            </button>
            <button
              onClick={() => setSubView('xr')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'xr'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3 h-3" />
              <span>DeFi Frame</span>
            </button>
            <button
              onClick={() => setSubView('grimoire')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'grimoire'
                  ? 'bg-purple-500/25 text-purple-200 border border-purple-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              <span>Grimoire v7</span>
            </button>
            <button
              onClick={() => setSubView('studio')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'studio'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Image Studio</span>
            </button>
            <button
              onClick={() => setSubView('void')}
              className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition-all ${
                subView === 'void'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Void() Engine</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 border border-[#00f0ff]/30 text-[11px]">
            {isVoiceActive ? (
              <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span className={isVoiceActive ? 'text-emerald-300 font-bold' : 'text-gray-400'}>
              {voiceTranscript ? `"${voiceTranscript}"` : isVoiceActive ? 'Voice Active' : 'Voice Standby'}
            </span>
          </div>

          <button
            onClick={triggerMooncakeProtocol}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
              isMooncakeActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse'
                : 'bg-black/60 hover:bg-amber-500/10 border-amber-500/40 text-amber-400'
            }`}
          >
            <span className="text-sm">🥮</span>
            <span>{isMooncakeActive ? 'Mooncake Active' : 'Mooncake'}</span>
          </button>

          <button
            onClick={() => {
              setFrameCount((prev) => prev + 1);
              logLedger(`FRAME ${frameCount} spawned manually`);
            }}
            className="px-2.5 py-1 rounded bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 border border-[#00f0ff]/40 text-[#00f0ff] text-xs font-bold transition-all flex items-center gap-1"
          >
            <Layers className="w-3 h-3" />
            <span>+ Frame ({frameCount})</span>
          </button>

          <button
            onClick={() => setHudOpacity((prev) => (prev === 1.0 ? 0.78 : prev === 0.78 ? 0.55 : 1.0))}
            className="px-2.5 py-1 rounded bg-black/50 hover:bg-black/80 border border-gray-700 text-gray-300 text-xs font-mono transition-all flex items-center gap-1"
          >
            <Eye className="w-3 h-3 text-cyan-400" />
            <span>{(hudOpacity * 100).toFixed(0)}%</span>
          </button>

          {onExit && (
            <button
              onClick={onExit}
              className="px-3 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold transition-all"
            >
              Exit XR
            </button>
          )}
        </div>
      </div>

      {/* Main Omega Frame Container */}
      <div className="relative w-full min-h-[calc(100vh-125px)] p-3 sm:p-5 flex flex-col justify-start items-center z-10 gap-5">
        {/* Frame 0 Boundary */}
        <div
          className="absolute pointer-events-none rounded-2xl transition-all duration-700"
          style={{
            top: '0.5%',
            left: '0.5%',
            width: '99%',
            height: '99%',
            border: '1px solid rgba(0, 255, 255, 0.15)',
            boxShadow: '0 0 30px rgba(0, 255, 255, 0.1)',
            zIndex: 1,
          }}
        />

        {/* Frame 1 Main Monolith Panel */}
        <div
          className="relative w-full rounded-2xl transition-all duration-700 flex flex-col overflow-hidden"
          style={{
            border: isMooncakeActive
              ? '1px solid rgba(245, 158, 11, 0.55)'
              : '1px solid rgba(168, 85, 247, 0.35)',
            backdropFilter: 'blur(12px)',
            backgroundColor: `rgba(4, 7, 16, ${0.84 * hudOpacity})`,
            boxShadow: isMooncakeActive
              ? '0 0 45px rgba(245, 158, 11, 0.35), inset 0 0 35px rgba(245, 158, 11, 0.12)'
              : '0 0 40px rgba(139, 92, 246, 0.22), inset 0 0 35px rgba(0, 255, 255, 0.08)',
            zIndex: 5,
          }}
        >
          {/* Anchor Status Bar */}
          <div className="p-3 bg-black/60 border-b border-purple-500/25 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isMooncakeActive ? 'bg-amber-400' : 'bg-purple-400'} animate-ping`} />
              <span className="font-bold text-white tracking-wider">
                OMEGA FRAME 1 &bull; CHRONOSPHERE ANCHOR [0.0.0.0] &bull; {realmInfo.tag}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400 font-mono">
              <span>Monotonic: <strong className="text-cyan-300 tabular-nums">{clockMonotonicNs} ns</strong></span>
              <span>Epoch: <strong className="text-purple-300">{clockEpochId}</strong></span>
              <span className={isMooncakeActive ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                {isMooncakeActive ? 'MOONCAKE ENCLAVE ACTIVE' : 'NOMINAL'}
              </span>
            </div>
          </div>

          {isMooncakeActive && (
            <div className="mx-3 sm:mx-4 mt-3 p-4 rounded-xl bg-gradient-to-r from-amber-950/90 via-[#0a0601] to-amber-950/90 border border-amber-400/70 text-amber-200 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-2xl p-2 rounded-xl bg-amber-500/20 border border-amber-400/50">🥮</div>
                  <div>
                    <div className="font-black text-amber-300 text-sm tracking-[2px]">
                      THE MOONCAKE SEAL &bull; SYNODIC ENCLAVE PROTOCOL
                    </div>
                    <p className="text-xs text-amber-200/90 italic">
                      &ldquo;The 15th night. The lunar harmonic. From the seed, through the cycle, unto the grandpod.&rdquo;
                    </p>
                  </div>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-black/80 border border-amber-400/50 text-xs font-bold text-emerald-400">
                  +888.88 SATS ALLOCATED
                </div>
              </div>
            </div>
          )}

          {/* V7 DREAMING GRIMOIRE, MACRO IMAGE STUDIO, VOID() INSPECTOR */}
          {subView === 'grimoire' && <DreamingGrimoireWorkspace />}
          {subView === 'studio' && <MacroImageStudio />}
          {subView === 'void' && <CosmicGuardianVoidWorkspace />}

          {/* ONEIROS CHRONOSPHERE + COGNITIVE JOURNAL */}
          {(subView === 'chronosphere' || subView === 'split') && (
            <div className="w-full p-4 sm:p-6 border-b border-purple-500/20 font-sans text-slate-200">
              {realityAlert && (
                <div className="mb-4 p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-amber-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span><strong>REALITY CHECK TRIGGERED:</strong> Inspect your surroundings and verify monotonic epoch <code>{clockEpochId}</code>.</span>
                  </div>
                  <button
                    onClick={() => setRealityAlert(false)}
                    className="px-2.5 py-1 rounded bg-amber-500/25 border border-amber-400/50 text-amber-100 font-bold"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column (5 cols): Dreamscape Tuner + Cognitive Log + Reality Timer */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Dreamscape Generator Card */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-5 space-y-4">
                    <div>
                      <h2 className="text-base font-semibold text-purple-300 flex items-center gap-2">
                        <Moon className="w-4 h-4 text-purple-400" />
                        <span>ONEIROS Dreamscape Generator</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Calibrate the interactive cognitive visualization &amp; 6D WebGL matrix.
                      </p>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <label className="text-slate-300">Lucidity Index</label>
                          <span className="text-purple-400 font-mono tabular-nums">{lucidity}%</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={lucidity}
                          onChange={(e) => setLucidity(Number(e.target.value))}
                          className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <label className="text-slate-300">Emotional Intensity</label>
                          <span className="text-pink-400 font-mono tabular-nums">{intensity}%</span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          value={intensity}
                          onChange={(e) => setIntensity(Number(e.target.value))}
                          className="w-full accent-pink-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-medium mb-1">
                          <label className="text-slate-300">Subconscious Chaos</label>
                          <span className="text-indigo-400 font-mono tabular-nums">{chaos}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={chaos}
                          onChange={(e) => setChaos(Number(e.target.value))}
                          className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-2">Atmospheric Realm</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(Object.keys(REALM_META) as DreamRealm[]).map((r) => (
                            <button
                              key={r}
                              onClick={() => {
                                setRealm(r);
                                logLedger(`🌌 [ONEIROS] Switched Chronosphere realm -> ${REALM_META[r].label}`);
                              }}
                              className={`py-2 px-3 rounded-lg border text-left font-medium transition-all ${
                                realm === r
                                  ? REALM_META[r].activeClass
                                  : 'border-white/5 bg-slate-950/60 text-slate-400 hover:bg-slate-800/60'
                              }`}
                            >
                              {REALM_META[r].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cognitive Log & Interpretation Entry Card */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-5 space-y-3">
                    <div>
                      <h2 className="text-base font-semibold text-pink-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-pink-400" />
                        <span>Cognitive Log</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Record dream details to persist semantic analysis into SQLite anchored to Universal Clock epochs.
                      </p>
                    </div>

                    <textarea
                      rows={3}
                      value={dreamText}
                      onChange={(e) => setDreamText(e.target.value)}
                      placeholder="Describe the environment, sensations, or interactions..."
                      className="w-full bg-slate-950/75 border border-white/10 rounded-lg p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-pink-500/50 resize-none"
                    />

                    <div>
                      <span className="block text-xs font-medium text-slate-400 mb-2">
                        Recurring Archetypes / Indicators:
                      </span>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        {ARCHETYPES.map((arch) => {
                          const active = selectedArchetypes.includes(arch.id);
                          return (
                            <button
                              key={arch.id}
                              onClick={() => toggleArchetype(arch.id)}
                              className={`px-2.5 py-1 rounded-lg border transition-all ${
                                active
                                  ? 'bg-pink-500/20 border-pink-400/60 text-pink-200 font-semibold'
                                  : 'bg-slate-950 border-white/10 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              {arch.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {dreamNotice && (
                      <div className="text-xs text-amber-300 bg-amber-950/50 border border-amber-500/30 rounded-lg p-2">
                        {dreamNotice}
                      </div>
                    )}

                    <button
                      onClick={handleAnalyzeDream}
                      disabled={submittingLog}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-60 text-white font-semibold text-xs py-2.5 rounded-lg transition-all"
                    >
                      {submittingLog ? 'Persisting & Cross-Referencing...' : 'Analyze Log Variables & Save to SQLite'}
                    </button>

                    {latestAnalysis && (
                      <div className="pt-3 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="uppercase tracking-wider text-purple-400 font-bold">
                            Analytical Output ({latestAnalysis.logId})
                          </span>
                          <span className="font-mono text-[10px] text-cyan-300">
                            Epoch {latestAnalysis.clockEpochId}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-white/5">
                          {latestAnalysis.analysisText}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Lucid Training Trigger Card */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-indigo-300 mb-2.5 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>Lucid Training Trigger</span>
                    </h2>
                    <div className="flex items-center justify-between bg-slate-950/60 rounded-lg p-3 border border-white/5">
                      <div className="text-xs">
                        <p className="text-slate-200 font-medium">Interval Reality Check</p>
                        <p className="text-slate-500 text-[10px]">Trains waking metacognition habits</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-indigo-300 bg-slate-900 px-2.5 py-1 rounded border border-white/10 tabular-nums">
                          {formatTimer(timerSeconds)}
                        </span>
                        <button
                          onClick={() => setTimerRunning((v) => !v)}
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-lg text-white font-medium flex items-center gap-1"
                        >
                          {timerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          <span>{timerRunning ? 'Pause' : 'Start'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setTimerRunning(false);
                            setTimerSeconds(300);
                            setRealityAlert(false);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Reset 5-minute reality check timer"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (7 cols): Interactive Chronosphere Field + Subconscious Distribution + History */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Interactive Chronosphere Visualizer Window */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-4 flex flex-col h-[390px] relative">
                    <div className="absolute top-6 left-6 z-10 pointer-events-none flex flex-col gap-1">
                      <span className="text-[10px] tracking-widest uppercase font-bold text-purple-300 bg-purple-950/75 border border-purple-500/35 px-2.5 py-1 rounded w-max">
                        {realmInfo.tag}
                      </span>
                      <span className="text-slate-300 text-[11px] bg-slate-950/60 px-2 py-0.5 rounded w-max">
                        {realmInfo.subtitle} &bull; Move cursor to perturb nodes
                      </span>
                    </div>

                    <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
                      {companionLine && (
                        <div className="bg-slate-900/95 border border-purple-500/40 text-purple-200 text-[11px] py-1.5 px-3 rounded-lg max-w-[220px] shadow-lg">
                          {companionLine}
                        </div>
                      )}
                      <button
                        onClick={handleTapCompanion}
                        className="relative bg-slate-900/90 border border-white/15 p-1.5 rounded-xl flex items-center justify-center cursor-pointer hover:border-purple-400/60 transition-all"
                        title="Tap Dream Companion"
                      >
                        <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
                          <path d="M25 40 L15 15 L40 28 Z" fill="#7C3AED" />
                          <path d="M28 38 L20 20 L38 29 Z" fill="#F472B6" />
                          <path d="M75 40 L85 15 L60 28 Z" fill="#7C3AED" />
                          <path d="M72 38 L80 20 L62 29 Z" fill="#F472B6" />
                          <circle cx="50" cy="55" r="32" fill="#7C3AED" />
                          <path d="M50 25 C30 25 22 38 22 55 C22 72 32 85 50 85 C68 85 78 72 78 55 C78 38 70 25 50 25 Z" fill="#F472B6" />
                          <ellipse cx="38" cy="54" rx="7" ry="9" fill="#1E1B4B" />
                          <ellipse cx="62" cy="54" rx="7" ry="9" fill="#1E1B4B" />
                          <circle cx="36" cy="51" r="2.5" fill="#FFFFFF" />
                          <circle cx="60" cy="51" r="2.5" fill="#FFFFFF" />
                          <polygon points="50,62 47,59 53,59" fill="#1E1B4B" />
                          <path d="M46 65 Q50 68 54 65" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" fill="none" />
                        </svg>
                        <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border border-slate-900 rounded-full" />
                      </button>

                      <button
                        onClick={() => {
                          remPulseRef.current = 1.0;
                          logLedger('⚡ [ONEIROS] Manual REM flash pulse injected into Chronosphere');
                        }}
                        className="bg-slate-900/90 hover:bg-slate-800 border border-white/15 px-2.5 py-2 rounded-lg text-xs text-purple-200 flex items-center gap-1"
                        title="Induce REM Flash Pulse"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-300" />
                        <span>REM Pulse</span>
                      </button>
                    </div>

                    <div
                      className="w-full flex-1 rounded-xl bg-slate-950/90 border border-white/10 overflow-hidden relative"
                      onPointerMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        pointerRef.current = {
                          x: e.clientX - rect.left,
                          y: e.clientY - rect.top,
                          active: true,
                        };
                      }}
                      onPointerLeave={() => {
                        pointerRef.current.active = false;
                      }}
                    >
                      <canvas ref={dreamCanvasRef} className="block w-full h-full" />
                    </div>
                  </div>

                  {/* Subconscious Core Distribution (Observed SQLite Logs vs Empirical Baseline) */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-pink-400" />
                          <span>Subconscious Core Distribution</span>
                        </h2>
                        <p className="text-[11px] text-slate-400">
                          Live distribution computed from {dreamLogs.length} SQLite-persisted journal entries vs empirical baseline.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-300">
                        SQLite + Empirical Hub
                      </span>
                    </div>

                    <div className="space-y-3">
                      {distribution.map((item) => (
                        <div key={item.archetype} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-200 font-medium">{item.label}</span>
                            <span className="font-mono text-[11px] tabular-nums">
                              <span className="text-cyan-300 font-semibold">
                                Observed: {item.observedPct}% ({item.observedCount})
                              </span>
                              <span className="text-slate-500 mx-1.5">|</span>
                              <span className="text-purple-400">Baseline: {item.referenceSurveyPct}%</span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/5 relative">
                            <div
                              className="bg-purple-500/30 h-full absolute top-0 left-0 rounded-full"
                              style={{ width: `${item.referenceSurveyPct}%` }}
                            />
                            <div
                              className="bg-gradient-to-r from-cyan-400 to-pink-500 h-full relative rounded-full transition-all duration-700"
                              style={{ width: `${item.observedPct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Persisted SQLite Journal History */}
                  <div className="bg-slate-900/65 border border-white/10 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span>Persisted Cognitive Journal ({dreamLogs.length})</span>
                      <span className="text-[10px] font-mono text-slate-500">Table: dream_logs (WAL SQLite)</span>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {dreamLogs.length === 0 ? (
                        <div className="text-xs text-slate-500 py-4 text-center">
                          No persisted entries yet. Record your first dream above to stamp it to the active clock epoch.
                        </div>
                      ) : (
                        dreamLogs.map((entry) => (
                          <div key={entry.logId} className="p-2.5 rounded-lg bg-slate-950/70 border border-white/5 text-xs space-y-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                              <span className="text-purple-300 font-bold">
                                {entry.logId} &bull; {REALM_META[entry.realm]?.label || entry.realm}
                              </span>
                              <span className="text-cyan-300">
                                Epoch {entry.clockEpochId} &bull; L:{entry.lucidity}% E:{entry.intensity}% C:{entry.chaos}%
                              </span>
                            </div>
                            <p className="text-slate-200">{entry.dreamText}</p>
                            <p className="text-[11px] text-slate-400">{entry.analysisText}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Embedded DeFi Arbitrage Engine Content (when in 'xr' or 'split') */}
          {(subView === 'xr' || subView === 'split') && (
            <div className="w-full flex-1 p-2 sm:p-4 overflow-y-auto">
              {children}
            </div>
          )}
        </div>

        {/* Frame 2 Accent Frame */}
        {frameCount >= 3 && (
          <div
            className="absolute pointer-events-none rounded-2xl transition-all duration-700"
            style={{
              top: '5%',
              left: '5%',
              width: '90%',
              height: '90%',
              border: '1px solid rgba(0, 255, 255, 0.12)',
              boxShadow: '0 0 50px rgba(0, 255, 255, 0.08)',
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* Real-time Genesis Ledger (Bottom-Left Console) */}
      <div
        id="ledger"
        ref={ledgerRef}
        className="fixed bottom-3 left-3 w-80 h-32 overflow-y-auto bg-black/85 border border-cyan-500/35 p-2.5 text-[10px] font-mono rounded-lg z-30 shadow-2xl backdrop-blur-md select-text"
        style={{
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.2)',
        }}
      >
        <div className="text-cyan-400 font-bold pb-1 mb-1 border-b border-gray-800 flex items-center justify-between">
          <span>GENESIS LEDGER DIAGNOSTICS</span>
          <span className="text-[9px] text-gray-500 font-normal">REAL-TIME</span>
        </div>
        <div className="space-y-0.5 text-gray-300">
          {ledgerEntries.map((log, idx) => (
            <div key={idx} className="leading-tight">
              {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
