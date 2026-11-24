/**
 * =============================================================================
 * SPECIFICATION: HCCGN.UCLK.DUAL.ADAPTIVE v1.0 (Section 9.1)
 * MODULE: Deterministic Canonical Serialization for Cryptographic Receipts
 * =============================================================================
 * Shared cleanly between Node.js server (crypto.createHash('sha256')) and browser
 * verification (crypto.subtle.digest('SHA-256')) so verification never compares
 * a digest with itself.
 */

import { TemporalEventReceipt } from '../contracts/universal-clock';

export function serializeCanonicalEventPayload(
  receipt: Omit<TemporalEventReceipt, 'receipt_digest'>
): string {
  // Explicit fixed field ordering matching Section 9 minimum contract
  const canonicalOrderedTuple = [
    receipt.schema_version,
    receipt.event_id,
    receipt.epoch_id,
    receipt.sequence_number,
    receipt.parent_event_id ?? 'NULL',
    receipt.parent_receipt_digest ?? 'NULL',
    receipt.lane_id,
    receipt.scheduled_deadline_ns,
    receipt.actual_dispatch_ns,
    receipt.actual_completion_ns,
    receipt.clock_domain,
    receipt.clock_source,
    receipt.clock_uncertainty_ns,
    receipt.jitter_ns,
    receipt.execution_duration_ns,
    receipt.admitted_operations,
    receipt.completed_operations,
    receipt.completed_bytes,
    receipt.verification_status,
    receipt.deadline_status,
    receipt.operator_version,
    receipt.source_ticket_id,
  ];

  return JSON.stringify(canonicalOrderedTuple);
}

/**
 * Independent browser-side SHA-256 verification helper using WebCrypto API.
 */
export async function verifyReceiptDigestBrowser(
  receipt: TemporalEventReceipt
): Promise<{ valid: boolean; recomputedDigest: string; expectedDigest: string }> {
  const { receipt_digest, ...unsigned } = receipt;
  const serialized = serializeCanonicalEventPayload(unsigned);
  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const recomputedDigest = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    valid: recomputedDigest === receipt_digest,
    recomputedDigest,
    expectedDigest: receipt_digest,
  };
}
