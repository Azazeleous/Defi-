import { OperatorToken } from '../../contracts/axs-polyglot';

export interface PipelineStage {
  readonly stageIndex: number;
  readonly command: string;
  readonly args: readonly string[];
  readonly incomingOperator?: OperatorToken;
  readonly outgoingOperator?: OperatorToken;
}

export interface PipelineExecutionResult {
  readonly pipelineId: string;
  readonly success: boolean;
  readonly output: string;
  readonly exitCode: number;
  readonly elapsedMs: number;
  readonly stagesExecuted: number;
  readonly error?: string;
}

export interface ExecutionPipeline {
  parse(rawCommand: string): readonly PipelineStage[];
  execute(stages: readonly PipelineStage[], initialInput?: string): Promise<PipelineExecutionResult>;
}
