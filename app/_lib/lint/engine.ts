import { SEMANTIC_RULES } from './rules/semantic';
import { STRUCTURE_RULES } from './rules/structure';
import type { LintIssue, LintRule, LintRuleContext } from './types';

export type { LintIssue, LintRuleContext, LintRule, LintSeverity } from './types';

export const ALL_LINT_RULES: LintRule[] = [...STRUCTURE_RULES, ...SEMANTIC_RULES];

/** Runs every structure/semantic rule against one block's per-language content. */
export function lintBlock(context: LintRuleContext): LintIssue[] {
  return ALL_LINT_RULES.flatMap((rule) => rule.check(context));
}
