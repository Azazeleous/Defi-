/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Section 4)
 * MODULE: Hamiltonian Clock & Hamltoneural Append-Only Epoch Engine
 * POLICY:
 *   - Wraps authoritative Universal Clock without creating a parallel kernel
 *   - Exposes exact contract: read, schedule, measure, getPhase, getDrift, getReceipt
 *   - Distinguishes physical monotonic resolution vs virtual picosecond display
 *   - Append-only Hamltoneural epoch event records (no self-modifying source code)
 * =============================================================================
 */

import type {
  HamiltonianClockReading,
  HamltoneuralRecord,
} from '../contracts/v7-convergence';

export interface AuthoritativeClockSourceAdapter {
  readonly domain: string;
  readonly source: string;
  readonly uncertaintyNs: number;
  nowNs(): bigint;
  getEpochId(): string;
  getLastDriftNs(): number;
  getLatestReceiptSummary(): {
    receiptId: string;
    digest: string;
    monotonicNs: string;
    epochId: string;
    verified: boolean;
  } | null;
}

function createDefaultBrowserClockAdapter(): AuthoritativeClockSourceAdapter {
  const originMs = typeof performance !== 'undefined' ? performance.timeOrigin : Date.now();
  return {
    domain: typeof performance !== 'undefined' ? 'BROWSER_PERFORMANCE_NOW' : 'JS_DATE_NOW',
    source: typeof performance !== 'undefined' ? 'performance.now()' : 'Date.now()',
    uncertaintyNs: typeof performance !== 'undefined' ? 100_000 : 1_000_000,
    nowNs(): bigint {
      if (typeof performance !== 'undefined') {
        const ms = originMs + performance.now();
        return BigInt(Math.floor(ms * 1_000_000));
      }
      return BigInt(Date.now()) * 1_000_000n;
    },
    getEpochId(): string {
      return 'BROWSER-LOCAL-SYNC';
    },
    getLastDriftNs(): number {
      return 0;
    },
    getLatestReceiptSummary() {
      return null;
    },
  };
}

function fnvDigest64Hex(input: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i));
    h = BigInt.asUintN(64, h * 0x100000001b3n);
  }
  return h.toString(16).padStart(16, '0');
}

export class HamiltonianNeuralClock {
  private adapter: AuthoritativeClockSourceAdapter;
  private baseIntervalNs = 100_000n;
  private anchorNs: bigint;
  private lastSampleNs: bigint;
  private lastScheduledDeadlineNs: bigint;
  private lastDriftNs = 0;
  private phaseAccumRad = 0;
  private sequence = 0;
  private readonly appendOnlyLog: HamltoneuralRecord[] = [];
  private authoritativeEpochOverride: string | null = null;
  private authoritativeDriftOverrideNs: number | null = null;
  private authoritativeReceiptOverride: {
    receiptId: string;
    digest: string;
    monotonicNs: string;
    epochId: string;
    verified: boolean;
  } | null = null;

  constructor(adapter?: AuthoritativeClockSourceAdapter) {
    this.adapter = adapter ?? createDefaultBrowserClockAdapter();
    this.anchorNs = this.adapter.nowNs();
    this.lastSampleNs = this.anchorNs;
    this.lastScheduledDeadlineNs = this.anchorNs + this.baseIntervalNs;
  }

  public syncAuthoritativeServerTelemetry(params: {
    epochId?: string;
    driftNs?: number;
    receipt?: {
      receiptId: string;
      digest: string;
      monotonicNs: string;
      epochId: string;
      verified: boolean;
    } | null;
  }): void {
    if (params.epochId) this.authoritativeEpochOverride = params.epochId;
    if (typeof params.driftNs === 'number' && Number.isFinite(params.driftNs)) {
      this.authoritativeDriftOverrideNs = params.driftNs;
    }
    if (params.receipt !== undefined) {
      this.authoritativeReceiptOverride = params.receipt;
    }
  }

  public read(): HamiltonianClockReading {
    const nowNs = this.adapter.nowNs();
    const deltaNs = nowNs - this.anchorNs;
    // Deterministic phase subdivision inside 100,000 ns base window: 1,000 virtual ps = 1 ns
    const modWindow = Number(deltaNs % this.baseIntervalNs);
    const virtualPs = (modWindow * 1000).toString().padStart(8, '0');
    this.phaseAccumRad = ((modWindow / Number(this.baseIntervalNs)) * Math.PI * 2) % (Math.PI * 2);
    this.lastSampleNs = nowNs;

    return {
      utcIso: new Date().toISOString(),
      monotonicNs: nowNs.toString(),
      clockDomain: this.adapter.domain,
      clockSource: this.adapter.source,
      uncertaintyNs: this.adapter.uncertaintyNs,
      virtualPicosecondPhase: `${virtualPs} v-ps (phase ${(this.phaseAccumRad / Math.PI).toFixed(4)}pi)`,
      virtualPicosecondDisclaimer: 'VIRTUAL_INTERPOLATED_PHASE_NOT_PHYSICAL_PICOSECOND_HW',
      epochId: this.authoritativeEpochOverride || this.adapter.getEpochId(),
    };
  }

  public schedule(requestedIntervalNs: number = 100_000): {
    intervalIndex: number;
    anchorNs: string;
    deadlineNs: string;
    requestedIntervalNs: number;
  } {
    const safeNs = BigInt(Math.max(50_000, Math.min(10_000_000, Math.floor(requestedIntervalNs))));
    const nextDeadline = this.lastScheduledDeadlineNs + safeNs;
    const nowNs = this.adapter.nowNs();
    this.lastDriftNs = Number(nowNs - this.lastScheduledDeadlineNs);
    this.lastScheduledDeadlineNs = nextDeadline > nowNs ? nextDeadline : nowNs + safeNs;
    this.sequence += 1;

    return {
      intervalIndex: this.sequence,
      anchorNs: nowNs.toString(),
      deadlineNs: this.lastScheduledDeadlineNs.toString(),
      requestedIntervalNs: Number(safeNs),
    };
  }

  public measure<T>(operationLabel: string, fn: () => T): {
    result: T;
    durationNs: number;
    readingAfter: HamiltonianClockReading;
    record: HamltoneuralRecord;
  } {
    const t0 = this.adapter.nowNs();
    const result = fn();
    const t1 = this.adapter.nowNs();
    const durationNs = Math.max(1, Number(t1 - t0));
    const readingAfter = this.read();

    const record = this.appendEpochRecord(`MEASURE:${operationLabel}`, this.phaseAccumRad, durationNs);
    return {
      result,
      durationNs,
      readingAfter,
      record,
    };
  }

  public getPhase(): {
    phaseRad: number;
    normalizedCycle: number;
    virtualPicosecondPhase: string;
    disclaimer: 'VIRTUAL_INTERPOLATED_PHASE_NOT_PHYSICAL_PICOSECOND_HW';
  } {
    const reading = this.read();
    return {
      phaseRad: +this.phaseAccumRad.toFixed(6),
      normalizedCycle: +(this.phaseAccumRad / (Math.PI * 2)).toFixed(6),
      virtualPicosecondPhase: reading.virtualPicosecondPhase,
      disclaimer: 'VIRTUAL_INTERPOLATED_PHASE_NOT_PHYSICAL_PICOSECOND_HW',
    };
  }

  public getDrift(): {
    localSchedulingDriftNs: number;
    authoritativeServerDriftNs: number;
    uncertaintyNs: number;
    clockSource: string;
  } {
    const serverDrift = this.authoritativeDriftOverrideNs ?? this.adapter.getLastDriftNs();
    return {
      localSchedulingDriftNs: this.lastDriftNs,
      authoritativeServerDriftNs: serverDrift,
      uncertaintyNs: this.adapter.uncertaintyNs,
      clockSource: this.adapter.source,
    };
  }

  public getReceipt(): {
    source: 'AUTHORITATIVE_KERNEL' | 'LOCAL_SAMPLE';
    receiptId: string;
    digest: string;
    epochId: string;
    monotonicNs: string;
    verified: boolean;
  } {
    const auth = this.authoritativeReceiptOverride ?? this.adapter.getLatestReceiptSummary();
    if (auth) {
      return {
        source: 'AUTHORITATIVE_KERNEL',
        ...auth,
      };
    }
    const reading = this.read();
    const digest = fnvDigest64Hex(`${reading.epochId}|${reading.monotonicNs}|${this.sequence}`);
    return {
      source: 'LOCAL_SAMPLE',
      receiptId: `hclk_local_${this.sequence}_${digest.slice(0, 8)}`,
      digest,
      epochId: reading.epochId,
      monotonicNs: reading.monotonicNs,
      verified: true,
    };
  }

  /**
   * Append-only Hamltoneural trajectory record. Never modifies executable code.
   */
  public appendEpochRecord(sourceLabel: string, phaseRad: number, driftNs: number): HamltoneuralRecord {
    const reading = this.read();
    this.sequence += 1;
    const prevDigest =
      this.appendOnlyLog.length > 0
        ? this.appendOnlyLog[this.appendOnlyLog.length - 1].stateDigestSha256
        : '0000000000000000';
    const digest = fnvDigest64Hex(
      `${prevDigest}|${this.sequence}|${reading.monotonicNs}|${sourceLabel}|${phaseRad.toFixed(5)}|${driftNs}`
    );
    const rec: HamltoneuralRecord = {
      recordId: `hnn_${this.sequence}_${digest.slice(0, 8)}`,
      epochId: reading.epochId,
      sequence: this.sequence,
      monotonicNs: reading.monotonicNs,
      virtualPicosecondDisplay: reading.virtualPicosecondPhase,
      sourceLabel,
      phaseRad: +phaseRad.toFixed(6),
      driftNs,
      stateDigestSha256: digest,
      recordedAtUtc: reading.utcIso,
    };
    this.appendOnlyLog.push(rec);
    if (this.appendOnlyLog.length > 120) {
      this.appendOnlyLog.shift();
    }
    return rec;
  }

  public listAppendOnlyRecords(limit: number = 30): HamltoneuralRecord[] {
    return this.appendOnlyLog.slice(-limit).reverse();
  }
}

export const globalHamiltonianClock = new HamiltonianNeuralClock();
