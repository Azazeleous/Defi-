export interface LanguageProvider {
  readonly id: string;
  readonly locale: string;
  readonly encoding: string;
}

export type OperatorToken = '|' | '>' | '<' | '<--';

export interface CommandToken {
  readonly type: 'OPERATOR' | 'OPERAND' | 'JOINER';
  readonly value: string;
  readonly position: number;
}
