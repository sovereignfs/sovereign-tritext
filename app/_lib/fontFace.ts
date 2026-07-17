const FORMAT_BY_EXTENSION: Record<string, string> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
};

/** CSS `@font-face` `format()` hint from a filename/storage key's extension. */
export function guessFontFormat(filename: string): string {
  const extension = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  return FORMAT_BY_EXTENSION[extension] ?? 'woff2';
}

export interface FontFaceSourceLike {
  familyName: string;
  url: string;
  format: string;
}

/**
 * Builds raw `@font-face` CSS text for injection into a `<style>` tag.
 * `familyName` must already be restricted to a safe charset (see
 * `fonts-actions.ts`'s `FAMILY_NAME_PATTERN`) — this function does not
 * escape it, since CSS has no general-purpose string-escaping mechanism to
 * apply here. `url` is always a platform-generated signed URL, never
 * user-supplied text.
 */
export function fontFaceCss(fonts: FontFaceSourceLike[]): string {
  return fonts
    .map(
      (font) => `@font-face {
  font-family: "${font.familyName}";
  src: url("${font.url}") format("${font.format}");
  font-display: swap;
}`,
    )
    .join('\n');
}
