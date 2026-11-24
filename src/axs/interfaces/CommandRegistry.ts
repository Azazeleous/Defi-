import { CommandToken } from '../../contracts/axs-polyglot';

export interface CommandDefinition {
  readonly name: string;
  readonly aliases?: readonly string[];
  readonly description: string;
  readonly usage: string;
  readonly category: 'system' | 'telemetry' | 'lattice' | 'storage' | 'arbitrage' | 'crypto';
  readonly execute: (args: readonly string[], context: Record<string, unknown>) => Promise<string | Record<string, unknown>>;
}

export interface CommandRegistry {
  register(command: CommandDefinition): void;
  unregister(commandName: string): boolean;
  lookup(commandName: string): CommandDefinition | undefined;
  listAll(): readonly CommandDefinition[];
}
