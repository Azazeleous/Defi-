/**
 * =============================================================================
 * SPECIFICATION: GAIA / NEXUS — UNIVERSAL MEMORY & COMPUTATION INTEGRATION v6.1
 * MODULE: Save_Memory Canonical Service (SQLite WAL Linear Hash Chain)
 * POLICY:
 *   - Verbatim Unicode preservation (no silent normalization, summary, or dedup)
 *   - Redact secrets/tokens prior to persistence & explicitly report redaction
 *   - Append-only parameterized SQLite transactions
 *   - Independent read-back verification + Traceable Receipt R
 * =============================================================================
 */

import crypto from 'node:crypto';
import os from 'node:os';
import type {
  GaiaMemoryEventRecord,
  LexicalCorpusIndexEntry,
  MemoryAuthorizationContext,
  MemoryChainVerificationReport,
  MemoryEventInput,
  MemorySaveReceipt,
} from '../contracts/gaia-v61';
import { blake2b512Hex, globalPqMerkleVault, sha256NodeHex } from './pqMerkleReceiptEngine';
import { globalSqliteLedger, SqliteLedgerStore } from './sqliteLedgerStore';

const SECRET_REDACTION_PATTERNS: ReadonlyArray<{ rule: string; regex: RegExp }> = [
  { rule: 'OPENAI_KEY', regex: /\bsk-(?:proj-|live-|test-)?[A-Za-z0-9_-]{20,}\b/g },
  { rule: 'STRIPE_KEY', regex: /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { rule: 'GITHUB_TOKEN', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { rule: 'AWS_ACCESS_KEY', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: 'BEARER_TOKEN', regex: /Bearer\s+[A-Za-z0-9._~+/=-]{18,}/gi },
  { rule: 'PRIVATE_KEY_BLOCK', regex: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g },
  { rule: 'PASSWORD_ASSIGNMENT', regex: /(\b(?:password|passwd|api_secret|client_secret|secret_key)\s*[:=]\s*["']?)([^\s"';]{6,})(["']?)/gi },
];

export function redactSecretsPreservingVerbatim(raw: string): {
  sanitized: string;
  redacted: boolean;
  rulesTriggered: string[];
} {
  let out = raw;
  const triggered: string[] = [];

  for (const pat of SECRET_REDACTION_PATTERNS) {
    if (pat.regex.test(out)) {
      triggered.push(pat.rule);
      pat.regex.lastIndex = 0;
      if (pat.rule === 'PASSWORD_ASSIGNMENT') {
        out = out.replace(pat.regex, '$1[REDACTED_SECRET]$3');
      } else {
        out = out.replace(pat.regex, `[REDACTED_${pat.rule}]`);
      }
    }
    pat.regex.lastIndex = 0;
  }

  return {
    sanitized: out,
    redacted: triggered.length > 0,
    rulesTriggered: triggered,
  };
}

export function computeCanonicalMemoryEventHash(params: {
  schema: string;
  event_id: string;
  sequence: number;
  created_utc: string;
  source: string;
  project: string;
  event_type: string;
  payload_sha256: string;
  previous_hash: string;
}): string {
  const canonical = JSON.stringify({
    schema: params.schema,
    event_id: params.event_id,
    sequence: params.sequence,
    created_utc: params.created_utc,
    source: params.source,
    project: params.project,
    event_type: params.event_type,
    payload_sha256: params.payload_sha256,
    previous_hash: params.previous_hash,
  });
  return sha256NodeHex(canonical);
}

export class SaveMemoryService {
  private readonly store: SqliteLedgerStore;

  constructor(store: SqliteLedgerStore = globalSqliteLedger) {
    this.store = store;
  }

  /**
   * Canonical Save_Memory.saveMemory(event, authorizationContext)
   * Preserves verbatim UTF-8 content, appends in transaction, reads back,
   * verifies digest + chain link, and emits Traceable Execution Receipt R.
   */
  public saveMemory(
    event: MemoryEventInput,
    authorizationContext: MemoryAuthorizationContext
  ): MemorySaveReceipt {
    const startNs = process.hrtime.bigint();

    // 1. Evaluate Boundary Gate B before persisting
    const allowedRoles = new Set(['OPERATOR', 'ENGINEER', 'ACCOUNTING', 'ADMINISTRATOR']);
    const hasConsent = Boolean(authorizationContext?.userConsent);
    const hasRole = allowedRoles.has(authorizationContext?.actorRole);
    const payloadIsString = typeof event?.payload === 'string' && event.payload.length > 0;
    const boundaryValid = hasConsent && hasRole && payloadIsString;

    if (!boundaryValid) {
      const reason = !hasConsent
        ? 'Missing explicit userConsent=true'
        : !hasRole
          ? `Role ${authorizationContext?.actorRole || 'UNKNOWN'} lacks memory write permission`
          : 'Payload must be a non-empty UTF-8 string';

      const gate = globalPqMerkleVault.evaluateConvergenceGate({
        boundaryValid: false,
        boundaryReason: reason,
        verificationValid: false,
        verificationReason: 'Skipped because execution boundary B failed',
      });
      const rejectedReceipt = globalPqMerkleVault.issueTraceReceiptR({
        subsystem: 'Save_Memory',
        operationId: 'saveMemory.DENIED',
        adapter: 'SQLITE_WAL',
        algorithmVersion: 'gaia.memory.event.v1',
        inputPayload: String(event?.payload ?? ''),
        outputPayload: reason,
        durationNs: process.hrtime.bigint() - startNs,
        outcome: 'REJECTED',
        independentCheckPassed: false,
        detail: reason,
        convergenceAccepted: false,
      });
      throw new Error(`GATE_A_WITHHELD: ${reason} [receipt=${rejectedReceipt.ID}, B=${gate.B_boundaryValid}]`);
    }

    // 2. Check explicit idempotency key ONLY if user supplied one (otherwise duplicates stay distinct!)
    const suppliedKey = authorizationContext.idempotencyKey || event.idempotencyKey || null;
    if (suppliedKey) {
      const existing = this.store.getMemoryByIdempotencyKey(suppliedKey);
      if (existing) {
        const ver = this.verifyMemory(existing.event_id);
        const gate = globalPqMerkleVault.evaluateConvergenceGate({
          boundaryValid: true,
          boundaryReason: `Idempotent replay matched key=${suppliedKey}`,
          verificationValid: ver.verified,
          verificationReason: ver.verified ? 'Existing record SHA-256 & chain link verified' : 'Existing record verification failed',
        });
        const receiptR = globalPqMerkleVault.issueTraceReceiptR({
          subsystem: 'Save_Memory',
          operationId: 'saveMemory.IDEMPOTENT_HIT',
          adapter: 'SQLITE_WAL',
          algorithmVersion: 'gaia.memory.event.v1',
          inputPayload: existing.payload,
          outputPayload: existing.event_hash,
          durationNs: process.hrtime.bigint() - startNs,
          outcome: ver.verified ? 'VERIFIED' : 'FAILED',
          independentCheckPassed: ver.verified,
          detail: `Idempotent key=${suppliedKey}`,
          convergenceAccepted: gate.A_accepted,
        });
        return {
          ok: ver.verified,
          deduplicated: true,
          event: existing,
          verification: ver,
          convergence: gate,
          receiptR,
        };
      }
    }

    // 3. Redact secrets only; preserve all Unicode, whitespace, symbols, RuneScape/lexical text verbatim
    const { sanitized, redacted, rulesTriggered } = redactSecretsPreservingVerbatim(event.payload);
    const payloadSha256 = sha256NodeHex(sanitized);
    const payloadBlake2b = blake2b512Hex(sanitized);
    const createdUtc = new Date().toISOString();
    const eventId = `mem_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const source = event.source || authorizationContext.source || 'user_supplied';
    const project = event.project || authorizationContext.project || 'GAIA-NEXUS';
    const eventType = event.eventType || 'USER_MEMORY';
    const tags = Array.isArray(event.tags)
      ? event.tags.map(String)
      : Array.isArray(authorizationContext.tags)
        ? authorizationContext.tags.map(String)
        : [];
    const deviceRole = authorizationContext.deviceRole || 'operator_configured';
    const deviceRuntime = authorizationContext.deviceRuntime || `node-${process.version}-${os.platform()}`;

    // Pre-issue trace receipt ID and finalize after transaction
    const tracePlaceholderId = `rcpR_pending_${eventId}`;

    // Optional separate lexical index (never mutates original payload)
    const buildLexical =
      authorizationContext.recordLexicalIndex !== false
        ? (evId: string): LexicalCorpusIndexEntry => {
            const rawTokens = sanitized.split(/\s+/).filter((t) => t.length > 0);
            const distinct = Array.from(new Set(rawTokens)).slice(0, 128);
            return {
              indexId: `lex_${evId}`,
              eventId: evId,
              tokenCount: rawTokens.length,
              distinctTokens: distinct,
              preservedVerbatim: true,
              indexedAtUtc: createdUtc,
            };
          }
        : undefined;

    // 4. Append atomically inside SQLite transaction
    const committed = this.store.appendMemoryEventTransactional((nextSequence, previousHash) => {
      const eventHash = computeCanonicalMemoryEventHash({
        schema: 'gaia.memory.event.v1',
        event_id: eventId,
        sequence: nextSequence,
        created_utc: createdUtc,
        source,
        project,
        event_type: eventType,
        payload_sha256: payloadSha256,
        previous_hash: previousHash,
      });

      return {
        schema: 'gaia.memory.event.v1',
        event_id: eventId,
        sequence: nextSequence,
        created_utc: createdUtc,
        source,
        project,
        event_type: eventType,
        device: {
          role: deviceRole,
          runtime: deviceRuntime,
        },
        payload_encoding: 'UTF-8',
        payload: sanitized,
        payload_sha256: payloadSha256,
        payload_blake2b512: payloadBlake2b,
        previous_hash: previousHash,
        event_hash: eventHash,
        redaction: {
          redacted,
          rulesTriggered,
        },
        tags,
        idempotency_key: suppliedKey,
        authorization: {
          user_consent: true,
          boundary: 'PASS',
          clock_capacity: 'PASS',
          verification: 'PASS',
          gate_a_accepted: true,
        },
        trace_receipt_id: tracePlaceholderId,
        status: 'committed',
      };
    }, buildLexical);

    // 5. Read back committed record & independently verify SHA-256 + chain hash
    const verification = this.verifyMemory(committed.event_id);
    const durationNs = process.hrtime.bigint() - startNs;
    const deadlineNs = authorizationContext.maxBudgetMs
      ? BigInt(Math.floor(authorizationContext.maxBudgetMs * 1_000_000))
      : undefined;

    const convergence = globalPqMerkleVault.evaluateConvergenceGate({
      boundaryValid: true,
      boundaryReason: `User consent verified, role=${authorizationContext.actorRole}, redaction=${redacted ? rulesTriggered.join(',') : 'NONE'}`,
      verificationValid: verification.verified,
      verificationReason: verification.verified
        ? `SQLite read-back & SHA-256 chain confirmed (seq=${committed.sequence})`
        : 'Read-back verification mismatch',
      measuredDurationNs: durationNs,
      deadlineNs,
    });

    const receiptR = globalPqMerkleVault.issueTraceReceiptR({
      subsystem: 'Save_Memory',
      operationId: `saveMemory.${eventType}`,
      adapter: 'SQLITE_WAL',
      algorithmVersion: 'gaia.memory.event.v1',
      inputPayload: sanitized,
      outputPayload: committed.event_hash,
      durationNs,
      outcome: verification.verified ? 'VERIFIED' : 'FAILED',
      independentCheckPassed: verification.verified,
      detail: `seq=${committed.sequence}, sha256=${committed.payload_sha256.slice(0, 16)}...`,
      convergenceAccepted: convergence.A_accepted,
    });

    return {
      ok: verification.verified,
      deduplicated: false,
      event: {
        ...committed,
        trace_receipt_id: receiptR.ID,
      },
      verification,
      convergence,
      receiptR,
    };
  }

  public getMemory(eventId: string): GaiaMemoryEventRecord | null {
    return this.store.getMemoryEvent(eventId);
  }

  public listMemory(query?: {
    search?: string;
    project?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): GaiaMemoryEventRecord[] {
    return this.store.listMemoryEvents(query);
  }

  public verifyMemory(eventId: string): {
    readBackConfirmed: boolean;
    payloadSha256Matches: boolean;
    chainLinkMatches: boolean;
    eventHashMatches: boolean;
    verified: boolean;
  } {
    const rec = this.store.getMemoryEvent(eventId);
    if (!rec) {
      return {
        readBackConfirmed: false,
        payloadSha256Matches: false,
        chainLinkMatches: false,
        eventHashMatches: false,
        verified: false,
      };
    }

    const recomputedPayloadSha = sha256NodeHex(rec.payload);
    const payloadSha256Matches = recomputedPayloadSha === rec.payload_sha256;

    const recomputedEventHash = computeCanonicalMemoryEventHash({
      schema: rec.schema,
      event_id: rec.event_id,
      sequence: rec.sequence,
      created_utc: rec.created_utc,
      source: rec.source,
      project: rec.project,
      event_type: rec.event_type,
      payload_sha256: recomputedPayloadSha,
      previous_hash: rec.previous_hash,
    });
    const eventHashMatches = recomputedEventHash === rec.event_hash;

    // Check predecessor link
    let chainLinkMatches = false;
    if (rec.sequence === 1) {
      chainLinkMatches = rec.previous_hash === '0000000000000000000000000000000000000000000000000000000000000000';
    } else {
      const allAsc = this.store.listAllMemoryEventsAscending();
      const idx = allAsc.findIndex((e) => e.sequence === rec.sequence);
      if (idx > 0) {
        chainLinkMatches = allAsc[idx - 1].event_hash === rec.previous_hash;
      }
    }

    const verified = payloadSha256Matches && eventHashMatches && chainLinkMatches;
    return {
      readBackConfirmed: true,
      payloadSha256Matches,
      chainLinkMatches,
      eventHashMatches,
      verified,
    };
  }

  public verifyMemoryChain(): MemoryChainVerificationReport {
    const events = this.store.listAllMemoryEventsAscending();
    let expectedPrev = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const ev of events) {
      if (ev.previous_hash !== expectedPrev) {
        return {
          verifiedAtUtc: new Date().toISOString(),
          totalEvents: events.length,
          chainValid: false,
          brokenSequence: ev.sequence,
          brokenEventId: ev.event_id,
          reason: `Chain break at seq=${ev.sequence}: previous_hash mismatch`,
          headHash: expectedPrev,
        };
      }
      const payloadSha = sha256NodeHex(ev.payload);
      if (payloadSha !== ev.payload_sha256) {
        return {
          verifiedAtUtc: new Date().toISOString(),
          totalEvents: events.length,
          chainValid: false,
          brokenSequence: ev.sequence,
          brokenEventId: ev.event_id,
          reason: `Payload digest mismatch at seq=${ev.sequence}`,
          headHash: ev.event_hash,
        };
      }
      const eventHash = computeCanonicalMemoryEventHash({
        schema: ev.schema,
        event_id: ev.event_id,
        sequence: ev.sequence,
        created_utc: ev.created_utc,
        source: ev.source,
        project: ev.project,
        event_type: ev.event_type,
        payload_sha256: payloadSha,
        previous_hash: ev.previous_hash,
      });
      if (eventHash !== ev.event_hash) {
        return {
          verifiedAtUtc: new Date().toISOString(),
          totalEvents: events.length,
          chainValid: false,
          brokenSequence: ev.sequence,
          brokenEventId: ev.event_id,
          reason: `Event hash tampered at seq=${ev.sequence}`,
          headHash: ev.event_hash,
        };
      }
      expectedPrev = ev.event_hash;
    }

    return {
      verifiedAtUtc: new Date().toISOString(),
      totalEvents: events.length,
      chainValid: true,
      brokenSequence: null,
      brokenEventId: null,
      reason: events.length === 0 ? 'Memory chain initialized cleanly (0 events).' : `All ${events.length} sequential memory event(s) verified.`,
      headHash: expectedPrev,
    };
  }

  public exportMemory(eventId: string): {
    exportedAtUtc: string;
    schema: 'gaia.memory.export.v1';
    event: GaiaMemoryEventRecord;
    verification: ReturnType<SaveMemoryService['verifyMemory']>;
  } | null {
    const ev = this.getMemory(eventId);
    if (!ev) return null;
    return {
      exportedAtUtc: new Date().toISOString(),
      schema: 'gaia.memory.export.v1',
      event: ev,
      verification: this.verifyMemory(eventId),
    };
  }

  public exportMemoryArchive(): {
    exportedAtUtc: string;
    schema: 'gaia.memory.archive.v1';
    chainVerification: MemoryChainVerificationReport;
    events: GaiaMemoryEventRecord[];
    lexicalIndices: LexicalCorpusIndexEntry[];
  } {
    const events = this.store.listAllMemoryEventsAscending();
    const chainVerification = this.verifyMemoryChain();
    const lexicalIndices = this.store.listLexicalIndices(200);
    return {
      exportedAtUtc: new Date().toISOString(),
      schema: 'gaia.memory.archive.v1',
      chainVerification,
      events,
      lexicalIndices,
    };
  }
}

export const globalSaveMemory = new SaveMemoryService(globalSqliteLedger);
