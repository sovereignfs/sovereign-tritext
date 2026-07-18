import { describe, expect, it } from 'vitest';
import { fontFaceCss, guessFontFormat } from '../fontFace';

describe('guessFontFormat', () => {
  it.each([
    ['NotoSansSinhala.woff2', 'woff2'],
    ['NotoSansSinhala.woff', 'woff'],
    ['NotoSansSinhala.ttf', 'truetype'],
    ['NotoSansSinhala.otf', 'opentype'],
  ])('maps %s to %s', (filename, expected) => {
    expect(guessFontFormat(filename)).toBe(expected);
  });

  it('is case-insensitive on the extension', () => {
    expect(guessFontFormat('Font.WOFF2')).toBe('woff2');
  });

  it('falls back to woff2 for an unknown or missing extension', () => {
    expect(guessFontFormat('font.eot')).toBe('woff2');
    expect(guessFontFormat('font')).toBe('woff2');
  });
});

describe('fontFaceCss', () => {
  it('renders an empty string for no fonts', () => {
    expect(fontFaceCss([])).toBe('');
  });

  it('renders one @font-face block per font', () => {
    const css = fontFaceCss([
      { familyName: 'Noto Sans Sinhala', url: 'https://example.test/a.woff2', format: 'woff2' },
      { familyName: 'Noto Sans Tamil', url: 'https://example.test/b.ttf', format: 'truetype' },
    ]);
    expect(css).toContain('font-family: "Noto Sans Sinhala";');
    expect(css).toContain('src: url("https://example.test/a.woff2") format("woff2");');
    expect(css).toContain('font-family: "Noto Sans Tamil";');
    expect(css).toContain('src: url("https://example.test/b.ttf") format("truetype");');
    expect(css.match(/@font-face/g)).toHaveLength(2);
  });

  it('includes font-display: swap for every block', () => {
    const css = fontFaceCss([{ familyName: 'X', url: 'https://example.test/x.woff2', format: 'woff2' }]);
    expect(css).toContain('font-display: swap;');
  });
});
