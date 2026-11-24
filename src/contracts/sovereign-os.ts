import { ModuleIdentity, ModuleVersion, ModuleManifest as BaseModuleManifest } from './index';

export type HealthStatus = 'INITIALIZING' | 'READY' | 'DEGRADED' | 'UNAVAILABLE';

export interface SovereignModuleManifest extends BaseModuleManifest {
  readonly version: ModuleVersion;
  readonly compatibility: {
    readonly minApi: string;
    readonly supportedModules: string[];
  };
  readonly dependencies: string[];
}

export interface BootStage {
  readonly id: string;
  readonly name: string;
  readonly dependencies: string[];
  readonly readinessCheck: () => Promise<boolean>;
}
