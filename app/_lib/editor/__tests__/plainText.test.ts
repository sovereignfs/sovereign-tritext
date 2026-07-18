import { describe, expect, it } from 'vitest';
import { extractFullText, extractPlainText } from '../plainText';

function doc(...nodes: unknown[]): string {
  return JSON.stringify({ root: { children: nodes } });
}

function paragraph(text: string) {
  return { children: [{ text }] };
}

describe('extractFullText', () => {
  it('returns an empty string for null or empty input', () => {
    expect(extractFullText(null)).toBe('');
    expect(extractFullText('')).toBe('');
  });

  it('walks nested Lexical JSON and joins text nodes with a space', () => {
    const value = doc(paragraph('Hello'), paragraph('world'));
    expect(extractFullText(value)).toBe('Hello world');
  });

  it('skips nodes with no text and empty-string text nodes', () => {
    const value = JSON.stringify({
      root: { children: [{ children: [{ text: '' }, { text: 'Kept' }] }, {}] },
    });
    expect(extractFullText(value)).toBe('Kept');
  });

  it('falls back to the trimmed raw string when JSON.parse fails (pre-editor plain text)', () => {
    expect(extractFullText('  plain text fallback  ')).toBe('plain text fallback');
  });

  it('returns an empty string when parsed JSON has no root', () => {
    expect(extractFullText(JSON.stringify({}))).toBe('');
  });
});

describe('extractPlainText', () => {
  it('returns the full text unchanged when under the max length', () => {
    expect(extractPlainText(doc(paragraph('short')))).toBe('short');
  });

  it('truncates and appends an ellipsis when over the max length', () => {
    const long = 'a'.repeat(150);
    const result = extractPlainText(doc(paragraph(long)));
    expect(result).toBe(`${'a'.repeat(120)}…`);
  });

  it('respects a custom maxLength', () => {
    const result = extractPlainText(doc(paragraph('abcdefghij')), 5);
    expect(result).toBe('abcde…');
  });
});
