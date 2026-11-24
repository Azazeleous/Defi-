import { HealthStatus } from '../../contracts/sovereign-os';

export interface ComponentHealth {
  readonly componentId: string;
  readonly status: HealthStatus;
  readonly latencyMs: number;
  readonly lastHeartbeat: string; // UTC ISO-8601
  readonly message?: string;
  readonly errorCount: number;
}

export interface HealthMonitor {
  getSystemHealth(): Promise<HealthStatus>;
  getComponentHealth(componentId: string): Promise<ComponentHealth | null>;
  getAllComponents(): Promise<readonly ComponentHealth[]>;
  recordMetric(componentId: string, metricName: string, value: number): void;
}
