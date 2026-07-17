import type { Language } from '../../access';
import { extractFullText } from '../../editor/plainText';
import type { LintIssue, LintRule, LintRuleContext } from '../types';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

const PLACEHOLDER_PATTERN = /\b(TODO|FIXME|TBD|lorem ipsum|\[translate\])\b/i;

/** The shortest language version must be at least this fraction of the longest. */
const LENGTH_RATIO_FLOOR = 0.4;

function contentLengths(context: LintRuleContext): { lang: Language; length: number }[] {
  return context.enabledLanguages
    .map((lang) => ({ lang, length: extractFullText(context.content[lang]).length }))
    .filter((entry) => entry.length > 0);
}

/** Flags a language whose text is much shorter than the longest language version — a likely incomplete translation. */
export const lengthRatioOutlierRule: LintRule = {
  id: 'length-ratio-outlier',
  check(context) {
    const lengths = contentLengths(context);
    if (lengths.length < 2) return [];
    const maxLength = Math.max(...lengths.map((entry) => entry.length));
    return lengths
      .filter((entry) => entry.length < maxLength * LENGTH_RATIO_FLOOR)
      .map((entry) => ({
        ruleId: 'length-ratio-outlier',
        severity: 'warning',
        language: entry.lang,
        message: `${LANGUAGE_LABEL[entry.lang]} is much shorter than the longest language version — the translation may be incomplete.`,
      }));
  },
};

/** Flags leftover placeholder text (TODO, lorem ipsum, …) in any enabled language. */
export const placeholderTextRule: LintRule = {
  id: 'placeholder-text',
  check(context) {
    const issues: LintIssue[] = [];
    for (const lang of context.enabledLanguages) {
      const text = extractFullText(context.content[lang]);
      if (PLACEHOLDER_PATTERN.test(text)) {
        issues.push({
          ruleId: 'placeholder-text',
          severity: 'warning',
          language: lang,
          message: `${LANGUAGE_LABEL[lang]} contains placeholder text (e.g. "TODO" or "lorem ipsum").`,
        });
      }
    }
    return issues;
  },
};

export const SEMANTIC_RULES: LintRule[] = [lengthRatioOutlierRule, placeholderTextRule];
