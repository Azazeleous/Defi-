import { BootStage } from '../../contracts/sovereign-os';

export interface BootOrchestrator {
  readonly stages: BootStage[];
  execute(): Promise<void>;
  rollback(): Promise<void>;
  getReadiness(): Promise<boolean>;
}
