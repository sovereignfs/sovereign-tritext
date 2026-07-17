import type { Language } from '../access';

export type LintSeverity = 'error' | 'warning';

export interface LintIssue {
  ruleId: string;
  severity: LintSeverity;
  message: string;
  /** The language pane the issue concerns, if any. */
  language?: Language;
}

export interface LintRuleContext {
  enabledLanguages: Language[];
  /** Stored per-language content — Lexical JSON, or a pre-editor plain-text fallback. */
  content: Record<Language, string | null>;
}

export interface LintRule {
  id: string;
  check(context: LintRuleContext): LintIssue[];
}
