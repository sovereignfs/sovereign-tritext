import type { Language } from '../../access';
import { describeNode, nodeKind, parseStructure, type StructuralNode } from '../parseTree';
import type { LintIssue, LintRule, LintRuleContext } from '../types';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

function nonEmptyLanguages(context: LintRuleContext): Language[] {
  return context.enabledLanguages.filter((lang) => (context.content[lang] ?? '').trim().length > 0);
}

/**
 * Flags a language with no content at all while at least one other enabled
 * language has some — the clearest sign of a dropped/never-started
 * translation (SPEC.md's "no structural check that a Tamil translation
 * didn't drop a paragraph the Sinhala source has").
 */
export const emptyLanguageRule: LintRule = {
  id: 'empty-language',
  check(context) {
    const withContent = nonEmptyLanguages(context);
    if (withContent.length === 0 || withContent.length === context.enabledLanguages.length) {
      return [];
    }
    const missing = context.enabledLanguages.filter((lang) => !withContent.includes(lang));
    return missing.map((lang) => ({
      ruleId: 'empty-language',
      severity: 'error',
      language: lang,
      message: `${LANGUAGE_LABEL[lang]} has no content, but other enabled languages do.`,
    }));
  },
};

/** Flags a language with fewer top-level blocks (paragraphs/headings/lists/quotes) than another. */
export const blockCountMismatchRule: LintRule = {
  id: 'block-count-mismatch',
  check(context) {
    const withContent = nonEmptyLanguages(context);
    if (withContent.length < 2) return [];
    const counts = withContent.map((lang) => ({
      lang,
      count: parseStructure(context.content[lang]).length,
    }));
    const distinctCounts = new Set(counts.map((c) => c.count));
    if (distinctCounts.size <= 1) return [];

    const maxCount = Math.max(...counts.map((c) => c.count));
    return counts
      .filter((c) => c.count < maxCount)
      .map((c) => ({
        ruleId: 'block-count-mismatch',
        severity: 'warning',
        language: c.lang,
        message: `${LANGUAGE_LABEL[c.lang]} has ${c.count} block${c.count === 1 ? '' : 's'}, fewer than another language — a paragraph may be missing.`,
      }));
  },
};

/** Flags a mismatched block kind (e.g. one language has a heading where another has a paragraph) at the same position. */
export const headingMismatchRule: LintRule = {
  id: 'heading-mismatch',
  check(context) {
    const withContent = nonEmptyLanguages(context);
    if (withContent.length < 2) return [];
    const trees = withContent.map((lang) => ({ lang, nodes: parseStructure(context.content[lang]) }));
    const maxLength = Math.max(...trees.map((t) => t.nodes.length));

    const issues: LintIssue[] = [];
    for (let index = 0; index < maxLength; index += 1) {
      const atIndex = trees.map((t) => ({ lang: t.lang, node: t.nodes[index] }));
      // A missing node at this position is already covered by block-count-mismatch.
      if (atIndex.some(({ node }) => node === undefined)) continue;

      const presentNodes = atIndex as { lang: Language; node: StructuralNode }[];
      const signatures = new Set(presentNodes.map(({ node }) => nodeKind(node)));
      if (signatures.size > 1 && [...signatures].some((sig) => sig.startsWith('heading'))) {
        for (const { lang, node } of presentNodes) {
          issues.push({
            ruleId: 'heading-mismatch',
            severity: 'warning',
            language: lang,
            message: `Block ${index + 1}: structure doesn't match across languages (${LANGUAGE_LABEL[lang]} is ${describeNode(node)}).`,
          });
        }
      }
    }
    return issues;
  },
};

export const STRUCTURE_RULES: LintRule[] = [
  emptyLanguageRule,
  blockCountMismatchRule,
  headingMismatchRule,
];
