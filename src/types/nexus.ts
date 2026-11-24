export type CompressionCodec = "RAW" | "LZ4" | "ZSTD" | "SNAPPY" | "GZIP";

export const CODEC_ACTIONS: CompressionCodec[] = ["RAW", "LZ4", "ZSTD", "SNAPPY", "GZIP"];

export interface SystemMetrics {
  incoming_bytes: number;
  latency_ms: number;
  energy_expenditure_joules: number;
}

export interface PipelineAuditStep {
  stage: number;
  command: "pipethru" | "redirect";
  allocated_codec?: CompressionCodec;
  objective_cost_score?: number;
  intermediary_state_digest?: string;
  routing_destination?: string;
  sourceDatasetChunk?: string;
}

export interface PipelineExecutionResult {
  status: "SUCCESS" | "FAILED";
  processed_payload: string;
  final_system_state: SystemMetrics;
  execution_audit: PipelineAuditStep[];
  timestampMs: number;
  roundtripVerified?: boolean;
}

export interface QTableStateEntry {
  key: string; // "bytes-congestion-power"
  bytesFactor: number;
  congestionFactor: number;
  powerFactor: number;
  qValues: Record<CompressionCodec, number>;
  optimalAction: CompressionCodec;
  visitCount: number;
}

export interface ARXStateSnapshot {
  words: number[]; // 8 words [A, B, C, D, E, F, G, H]
  hexString: string;
  stepCount: number;
  lastOperation: "FORWARD" | "BACKWARD" | "INIT" | "POTENTIAL";
  bijectiveVerified: boolean;
  roundtripDeltaZero: boolean;
}

export interface ELRCReallocationMetrics {
  currentJoules: number;
  joulesSavedPct: number;
  allocatedCodec: CompressionCodec;
  cpuThermalHeadroomPct: number;
  ohmEquilibriumDraw: number;
  reallocatedPowerWatts: number;
  perpetualBalanceScore: number;
  entropyEfficiency: number;
}

export interface NexusFourLaneAllocation {
  lane1Bytes: number; // 2,097,152 (2,000,000 payload + 97,152 tail)
  lane2Bytes: number; // 2,097,152 (2,000,000 payload + 97,152 tail)
  lane3Bytes: number; // 2,097,152 (2,000,000 payload + 97,152 tail)
  lane4Bytes: number; // 2,097,152 (2,000,000 payload + 97,152 tail)
  aggregateBytes: number; // 8,388,608 (8 MiB exactly)
}

export interface NexusBlockchainRecord {
  blockIndex: number;
  previousHash: string;
  currentHash: string;
  fnvIsoBeat: string;
  isoBeatHz: number;
  timestampMs: number;
  epochFormatted: string;
  arxStateDigest: string;
  codecAllocated: CompressionCodec;
  payloadBytes: number;
  fourLaneAlloc: NexusFourLaneAllocation;
  costScore: number;
  energyJoules: number;
  enclaveSignature: string;
  cachedInTempStore: boolean;
  sourceDataset: string;
}

export interface NexusTempCacheState {
  totalCachedReceipts: number;
  memoryFootprintBytes: number;
  lastSavedTimestamp: number;
  zeroWasteConfirmed: boolean;
  persistenceTarget: "LOCAL_STORAGE_AND_SERVER_TEMP_CACHE";
}

