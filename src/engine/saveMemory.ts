/**
 * =============================================================================
 * SPECIFICATION: GAIA.NEXUS.HCCGN.QUANTUM-ROSE.V7 (Section 8)
 * MODULE: Canonical Save_Memory Interface (Single SQLite WAL Hash Chain Root)
 * =============================================================================
 * Consolidates directly onto SaveMemoryService + SqliteLedgerStore so there is
 * strictly ONE canonical memory chain across v6.1 and v7.0.0.
 */

import type {
  GaiaMemoryEventRecord,
  MemoryAuthorizationContext,
  MemoryChainVerificationReport,
  MemoryEventInput,
  MemorySaveReceipt,
} from '../contracts/gaia-v61';
import { globalSaveMemory, SaveMemoryService } from './saveMemoryService';

export { SaveMemoryService, globalSaveMemory };

export function saveMemory(
  event: MemoryEventInput,
  authorizationContext: MemoryAuthorizationContext
): MemorySaveReceipt {
  return globalSaveMemory.saveMemory(event, authorizationContext);
}

export function getMemory(eventId: string): GaiaMemoryEventRecord | null {
  return globalSaveMemory.getMemory(eventId);
}

export function listMemory(query?: {
  search?: string;
  project?: string;
  eventType?: string;
  limit?: number;
  offset?: number;
}): GaiaMemoryEventRecord[] {
  return globalSaveMemory.listMemory(query);
}

export function verifyMemory(eventId: string) {
  return globalSaveMemory.verifyMemory(eventId);
}

export function verifyMemoryChain(): MemoryChainVerificationReport {
  return globalSaveMemory.verifyMemoryChain();
}

export function exportMemory(eventId: string) {
  return globalSaveMemory.exportMemory(eventId);
}

export function exportMemoryArchive() {
  return globalSaveMemory.exportMemoryArchive();
}
