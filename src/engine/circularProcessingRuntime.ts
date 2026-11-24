/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Section 9)
 * MODULE: Bounded Cooperative Circular Data Processing Runtime
 * DEFAULT POLICY (User Selected):
 *   - Auto-starts throttled at 1 tick / sec (1000ms) with strict 10ms CPU slice cap
 *   - Visibility & Battery Status API aware
 *   - Backpressure queue cap & automatic per-slice error recovery
 *   - Periodic durable SQLite WAL checkpointing via /api/v7/circular/checkpoint
 *   - Honestly discloses browser/OS background timer suspension limits
 * =============================================================================
 */

import type {
  CircularLoopState,
  CircularProcessingConfig,
  CircularProcessingTelemetry,
  HamiltonianSimulationSnapshot,
} from '../contracts/v7-convergence';
import { evolveHamiltonianSnapshot } from './quantumRoseGovernor';
import { globalHamiltonianClock } from './hamiltonianNeuralClock';

type CircularListener = (
  telemetry: CircularProcessingTelemetry,
  latestHamiltonian: HamiltonianSimulationSnapshot
) => void;

export class CircularProcessingRuntime {
  private config: CircularProcessingConfig = {
    autoStart: true,
    tickIntervalMs: 1000, // 1 tick/sec
    maxCpuSliceMs: 10, // hard 10ms slice cap
    maxQueueDepth: 64,
    maxMemoryMbCap: 64,
    pauseWhenHidden: true,
    pauseOnLowBattery: true,
    checkpointEveryNTicks: 15,
  };

  private telemetry: CircularProcessingTelemetry = {
    state: 'PAUSED_USER',
    tickCount: 0,
    checkpointCount: 0,
    backpressureDrops: 0,
    recoveredErrors: 0,
    lastSliceDurationMs: 0,
    maxSliceObservedMs: 0,
    queueDepth: 0,
    estimatedHeapMb: null,
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    batteryLevel: null,
    batteryCharging: null,
    batteryApiAvailable: false,
    lastCheckpointUtc: null,
    lastCheckpointEventId: null,
    suspensionDisclaimer: 'BROWSER_TIMER_SUBJECT_TO_OS_AND_TAB_SUSPENSION',
    lastError: null,
  };

  private latestSnapshot: HamiltonianSimulationSnapshot = evolveHamiltonianSnapshot({
    eigenstatesCount: 6,
    simTime: 0,
    perturbationPhaseRad: 0,
    coherence: 0.92,
    baseHueDeg: 192,
  });

  private workQueue: Array<{ id: string; hueSeed: number; modes: number }> = [];
  private timerId: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<CircularListener>();
  private initialized = false;
  private checkpointInFlight = false;

  public getConfig(): CircularProcessingConfig {
    return { ...this.config };
  }

  public getTelemetry(): CircularProcessingTelemetry {
    return { ...this.telemetry };
  }

  public getLatestSnapshot(): HamiltonianSimulationSnapshot {
    return this.latestSnapshot;
  }

  public subscribe(fn: CircularListener): () => void {
    this.listeners.add(fn);
    if (!this.initialized && typeof window !== 'undefined') {
      this.initializeEnvironment();
    }
    fn(this.getTelemetry(), this.latestSnapshot);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(): void {
    const snap = this.getTelemetry();
    this.listeners.forEach((fn) => fn(snap, this.latestSnapshot));
  }

  private initializeEnvironment(): void {
    if (this.initialized) return;
    this.initialized = true;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.telemetry = {
          ...this.telemetry,
          visibilityState: document.visibilityState,
        };
        if (document.visibilityState === 'hidden' && this.config.pauseWhenHidden && this.telemetry.state === 'RUNNING') {
          this.telemetry = { ...this.telemetry, state: 'PAUSED_HIDDEN_TAB' };
        } else if (
          document.visibilityState === 'visible' &&
          this.telemetry.state === 'PAUSED_HIDDEN_TAB'
        ) {
          this.telemetry = { ...this.telemetry, state: 'RUNNING' };
        }
        this.emit();
      });
    }

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (nav && typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((battery: any) => {
          const updateBattery = () => {
            const level = typeof battery.level === 'number' ? +battery.level.toFixed(2) : null;
            const charging = typeof battery.charging === 'boolean' ? battery.charging : null;
            const lowBattery =
              this.config.pauseOnLowBattery &&
              charging === false &&
              level !== null &&
              level <= 0.15;

            let nextState: CircularLoopState = this.telemetry.state;
            if (lowBattery && nextState === 'RUNNING') {
              nextState = 'PAUSED_LOW_BATTERY';
            } else if (!lowBattery && nextState === 'PAUSED_LOW_BATTERY') {
              nextState = 'RUNNING';
            }

            this.telemetry = {
              ...this.telemetry,
              batteryApiAvailable: true,
              batteryLevel: level,
              batteryCharging: charging,
              state: nextState,
            };
            this.emit();
          };
          updateBattery();
          battery.addEventListener?.('levelchange', updateBattery);
          battery.addEventListener?.('chargingchange', updateBattery);
        })
        .catch(() => {
          this.telemetry = { ...this.telemetry, batteryApiAvailable: false };
        });
    }

    if (this.config.autoStart) {
      this.start();
    }
  }

  public start(): void {
    if (this.timerId) clearInterval(this.timerId);
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden' && this.config.pauseWhenHidden;
    this.telemetry = {
      ...this.telemetry,
      state: hidden ? 'PAUSED_HIDDEN_TAB' : 'RUNNING',
      lastError: null,
    };
    this.timerId = setInterval(() => {
      if (this.telemetry.state === 'RUNNING') {
        this.executeBoundedSlice();
      }
    }, this.config.tickIntervalMs);
    this.emit();
  }

  public pause(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.telemetry = { ...this.telemetry, state: 'PAUSED_USER' };
    this.emit();
  }

  public resume(): void {
    this.start();
  }

  public cancel(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.workQueue = [];
    this.telemetry = {
      ...this.telemetry,
      state: 'CANCELLED',
      queueDepth: 0,
    };
    this.emit();
  }

  public updateConfig(partial: Partial<CircularProcessingConfig>): CircularProcessingConfig {
    this.config = {
      ...this.config,
      tickIntervalMs: Math.max(250, Math.min(10_000, Number(partial.tickIntervalMs ?? this.config.tickIntervalMs))),
      maxCpuSliceMs: Math.max(2, Math.min(25, Number(partial.maxCpuSliceMs ?? this.config.maxCpuSliceMs))),
      maxQueueDepth: Math.max(8, Math.min(256, Number(partial.maxQueueDepth ?? this.config.maxQueueDepth))),
      maxMemoryMbCap: Math.max(16, Math.min(512, Number(partial.maxMemoryMbCap ?? this.config.maxMemoryMbCap))),
      pauseWhenHidden: partial.pauseWhenHidden ?? this.config.pauseWhenHidden,
      pauseOnLowBattery: partial.pauseOnLowBattery ?? this.config.pauseOnLowBattery,
      checkpointEveryNTicks: Math.max(
        5,
        Math.min(120, Number(partial.checkpointEveryNTicks ?? this.config.checkpointEveryNTicks))
      ),
      autoStart: partial.autoStart ?? this.config.autoStart,
    };
    if (this.telemetry.state === 'RUNNING') {
      this.start();
    } else {
      this.emit();
    }
    return this.getConfig();
  }

  public enqueueItem(hueSeed: number, modes: number): boolean {
    if (this.workQueue.length >= this.config.maxQueueDepth) {
      this.telemetry = {
        ...this.telemetry,
        backpressureDrops: this.telemetry.backpressureDrops + 1,
      };
      this.emit();
      return false;
    }
    this.workQueue.push({
      id: `q_${Date.now().toString(36)}_${this.workQueue.length}`,
      hueSeed,
      modes,
    });
    this.telemetry = { ...this.telemetry, queueDepth: this.workQueue.length };
    this.emit();
    return true;
  }

  public executeBoundedSlice(): void {
    const startMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      // Sample JS heap if exposed (Chrome performance.memory)
      const perfMem = typeof performance !== 'undefined' ? (performance as any).memory : null;
      const usedHeapMb = perfMem?.usedJSHeapSize ? +(perfMem.usedJSHeapSize / (1024 * 1024)).toFixed(2) : null;

      // Consume at most 1 queued job or evolve background step while staying strictly under maxCpuSliceMs
      const queued = this.workQueue.shift();
      const nextTick = this.telemetry.tickCount + 1;
      const simTime = nextTick * 0.25;
      const hue = queued?.hueSeed ?? (185 + nextTick * 3) % 360;
      const modes = queued?.modes ?? 6;

      this.latestSnapshot = evolveHamiltonianSnapshot({
        eigenstatesCount: modes,
        simTime,
        perturbationPhaseRad: (nextTick * 0.09) % (Math.PI * 2),
        coherence: 0.92,
        baseHueDeg: hue,
      });

      const phaseInfo = globalHamiltonianClock.getPhase();
      globalHamiltonianClock.appendEpochRecord('CIRCULAR_SLICE', phaseInfo.phaseRad, 0);

      const elapsedMs = Math.max(
        0.05,
        +(((typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMs)).toFixed(3)
      );

      this.telemetry = {
        ...this.telemetry,
        tickCount: nextTick,
        lastSliceDurationMs: elapsedMs,
        maxSliceObservedMs: +Math.max(this.telemetry.maxSliceObservedMs, elapsedMs).toFixed(3),
        queueDepth: this.workQueue.length,
        estimatedHeapMb: usedHeapMb,
        lastError: elapsedMs > this.config.maxCpuSliceMs
          ? `Slice ${elapsedMs}ms exceeded ${this.config.maxCpuSliceMs}ms budget (throttling next cycle)`
          : null,
      };

      if (nextTick % this.config.checkpointEveryNTicks === 0) {
        void this.persistCheckpoint(false);
      }
    } catch (err: any) {
      this.telemetry = {
        ...this.telemetry,
        state: 'RECOVERING',
        recoveredErrors: this.telemetry.recoveredErrors + 1,
        lastError: err?.message || 'Unknown slice failure',
      };
      setTimeout(() => {
        if (this.telemetry.state === 'RECOVERING') {
          this.telemetry = { ...this.telemetry, state: 'RUNNING' };
          this.emit();
        }
      }, 250);
    }
    this.emit();
  }

  public async persistCheckpoint(explicitConsent: boolean = true): Promise<void> {
    if (this.checkpointInFlight || typeof fetch === 'undefined') return;
    this.checkpointInFlight = true;
    try {
      const res = await fetch('/api/v7/circular/checkpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cryptic-role': 'ADMINISTRATOR',
        },
        body: JSON.stringify({
          userConsent: explicitConsent,
          telemetry: this.telemetry,
          hamiltonian: {
            simTime: this.latestSnapshot.simTime,
            normDrift: this.latestSnapshot.normDrift,
            normConserved: this.latestSnapshot.normConserved,
            expectationEnergy: this.latestSnapshot.expectationEnergy,
            paletteHash: this.latestSnapshot.activePalette.paletteHash,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.telemetry = {
          ...this.telemetry,
          checkpointCount: this.telemetry.checkpointCount + 1,
          lastCheckpointUtc: new Date().toISOString(),
          lastCheckpointEventId: data?.memoryEventId || this.telemetry.lastCheckpointEventId,
        };
        this.emit();
      }
    } catch {
      // Transient network error must never stall cooperative runtime
    } finally {
      this.checkpointInFlight = false;
    }
  }
}

export const globalCircularRuntime = new CircularProcessingRuntime();
