/**
 * =============================================================================
 * PROJECT: GAIA EYES — HIGH-RATE QUANTUM GRID AUTOMATION
 * MODULE: Canonical Contract Layer (Baseline)
 * =============================================================================
 */

// Module Identity and Versioning
export interface ModuleIdentity {
  readonly id: string;
  readonly name: string;
  readonly version: string;
}

export interface ModuleVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

export type ModuleStatus = 'DEVELOPMENT' | 'STABLE' | 'DEPRECATED';

export interface ModuleManifest {
  readonly identity: ModuleIdentity;
  readonly status: ModuleStatus;
  readonly capabilities: readonly string[];
  readonly description: string;
}

// System Events & Execution Context
export interface SystemEvent {
  readonly eventId: string;
  readonly timestamp: string; // UTC ISO-8601
  readonly sourceModule: string;
  readonly correlationId?: string;
  readonly payload: unknown;
}

export interface ExecutionContext {
  readonly moduleId: string;
  readonly permissions: readonly string[];
  readonly sessionToken: string;
}

// Additional Shared Descriptors
export interface CompatibilityRange {
  readonly min: string;
  readonly max: string;
}

export interface CapabilityDescriptor {
  readonly id: string;
  readonly description: string;
  readonly version: string;
}

export interface DependencyDescriptor {
  readonly moduleId: string;
  readonly requiredVersion: string;
}

export interface IntegrityDescriptor {
  readonly algorithm: 'SHA-256' | 'BLAKE2B';
  readonly checksum: string;
  readonly verifiedAt: string;
}

// Re-export domain-specific contracts
export * from './dualtrace';
export * from './universal-clock';
export type { HealthStatus, SovereignModuleManifest, BootStage } from './sovereign-os';
export type { LanguageProvider, OperatorToken, CommandToken } from './axs-polyglot';
