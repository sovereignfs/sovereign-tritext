import { describe, expect, it } from 'vitest';
import type { Language } from '../../access';
import { emptyLanguageRule, blockCountMismatchRule, headingMismatchRule } from '../rules/structure';
import { lengthRatioOutlierRule, placeholderTextRule } from '../rules/semantic';
import { ALL_LINT_RULES, lintBlock } from '../engine';
import type { LintRuleContext } from '../types';

const ALL_LANGUAGES: Language[] = ['sinhala', 'tamil', 'english'];

function doc(...nodes: unknown[]): string {
  return JSON.stringify({ root: { children: nodes } });
}

function paragraph(text: string) {
  return { type: 'paragraph', children: [{ type: 'text', text }] };
}

function heading(tag: string, text: string) {
  return { type: 'heading', tag, children: [{ type: 'text', text }] };
}

function context(content: Partial<Record<Language, string | null>>): LintRuleContext {
  return {
    enabledLanguages: ALL_LANGUAGES,
    content: { sinhala: null, tamil: null, english: null, ...content },
  };
}

describe('emptyLanguageRule', () => {
  it('flags a language with no content when another has some', () => {
    const issues = emptyLanguageRule.check(
      context({ sinhala: doc(paragraph('Hello')), tamil: null, english: doc(paragraph('Hi')) }),
    );
    expect(issues).toEqual([
      { ruleId: 'empty-language', severity: 'error', language: 'tamil', message: expect.any(String) },
    ]);
  });

  it('does not flag when every language is empty', () => {
    expect(emptyLanguageRule.check(context({}))).toEqual([]);
  });

  it('does not flag when every language has content', () => {
    const filled = doc(paragraph('x'));
    expect(
      emptyLanguageRule.check(context({ sinhala: filled, tamil: filled, english: filled })),
    ).toEqual([]);
  });
});

describe('blockCountMismatchRule', () => {
  it('flags the language with fewer top-level blocks', () => {
    const issues = blockCountMismatchRule.check(
      context({
        sinhala: doc(paragraph('One'), paragraph('Two')),
        tamil: doc(paragraph('One')),
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'block-count-mismatch', language: 'tamil' });
  });

  it('does not flag when counts match', () => {
    const issues = blockCountMismatchRule.check(
      context({
        sinhala: doc(paragraph('One'), paragraph('Two')),
        tamil: doc(paragraph('Ek'), paragraph('Rendu')),
      }),
    );
    expect(issues).toEqual([]);
  });

  it('ignores languages with no content at all (empty-language already covers those)', () => {
    const issues = blockCountMismatchRule.check(
      context({ sinhala: doc(paragraph('One'), paragraph('Two')), tamil: null }),
    );
    expect(issues).toEqual([]);
  });
});

describe('headingMismatchRule', () => {
  it('flags a heading/paragraph mismatch at the same position', () => {
    const issues = headingMismatchRule.check(
      context({
        sinhala: doc(heading('h1', 'Title')),
        tamil: doc(paragraph('Not a heading')),
      }),
    );
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.language).sort()).toEqual(['sinhala', 'tamil']);
  });

  it('flags mismatched heading levels', () => {
    const issues = headingMismatchRule.check(
      context({
        sinhala: doc(heading('h1', 'Title')),
        tamil: doc(heading('h2', 'Title')),
      }),
    );
    expect(issues).toHaveLength(2);
  });

  it('does not flag identical structure', () => {
    const issues = headingMismatchRule.check(
      context({
        sinhala: doc(heading('h1', 'Title'), paragraph('Body')),
        tamil: doc(heading('h1', 'Title'), paragraph('Body')),
      }),
    );
    expect(issues).toEqual([]);
  });

  it('skips a position missing in one language (left to block-count-mismatch)', () => {
    const issues = headingMismatchRule.check(
      context({
        sinhala: doc(heading('h1', 'Title'), paragraph('Body')),
        tamil: doc(heading('h1', 'Title')),
      }),
    );
    expect(issues).toEqual([]);
  });
});

describe('lengthRatioOutlierRule', () => {
  it('flags a language much shorter than the longest', () => {
    const issues = lengthRatioOutlierRule.check(
      context({
        sinhala: doc(paragraph('A'.repeat(100))),
        tamil: doc(paragraph('short')),
      }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ ruleId: 'length-ratio-outlier', language: 'tamil' });
  });

  it('does not flag comparable lengths', () => {
    const issues = lengthRatioOutlierRule.check(
      context({
        sinhala: doc(paragraph('A'.repeat(50))),
        tamil: doc(paragraph('B'.repeat(45))),
      }),
    );
    expect(issues).toEqual([]);
  });
});

describe('placeholderTextRule', () => {
  it('flags leftover TODO text', () => {
    const issues = placeholderTextRule.check(context({ english: doc(paragraph('TODO: finish this')) }));
    expect(issues).toEqual([
      {
        ruleId: 'placeholder-text',
        severity: 'warning',
        language: 'english',
        message: expect.any(String),
      },
    ]);
  });

  it('flags lorem ipsum placeholder copy', () => {
    const issues = placeholderTextRule.check(
      context({ sinhala: doc(paragraph('lorem ipsum dolor sit amet')) }),
    );
    expect(issues).toHaveLength(1);
  });

  it('does not flag ordinary content', () => {
    expect(placeholderTextRule.check(context({ english: doc(paragraph('Real content.')) }))).toEqual(
      [],
    );
  });
});

describe('lintBlock', () => {
  it('aggregates issues from every rule', () => {
    const issues = lintBlock(
      context({
        sinhala: doc(heading('h1', 'Welcome'), paragraph('A long introduction paragraph here.')),
        tamil: doc(paragraph('TODO')),
        english: null,
      }),
    );

    const ruleIds = new Set(issues.map((i) => i.ruleId));
    expect(ruleIds.has('empty-language')).toBe(true);
    expect(ruleIds.has('block-count-mismatch')).toBe(true);
    expect(ruleIds.has('placeholder-text')).toBe(true);
  });

  it('returns no issues for a clean, fully translated block', () => {
    const issues = lintBlock(
      context({
        sinhala: doc(heading('h1', 'Title'), paragraph('Some real content here.')),
        tamil: doc(heading('h1', 'Talaippu'), paragraph('Idhu unmaiyaana உள்ளடக்கம்.')),
        english: doc(heading('h1', 'Title'), paragraph('Some real content here too.')),
      }),
    );
    expect(issues).toEqual([]);
  });

  it('runs every registered rule (sanity check against future additions)', () => {
    expect(ALL_LINT_RULES.length).toBeGreaterThanOrEqual(5);
  });
});
