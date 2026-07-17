interface LexicalJsonNode {
  text?: string;
  children?: LexicalJsonNode[];
}

/**
 * Best-effort plain-text extraction of stored block content — either
 * Lexical-serialized JSON or a pre-editor plain-text fallback (see
 * schema.ts). Never round-tripped back into the editor.
 */
export function extractFullText(value: string | null): string {
  if (!value) return '';

  let root: LexicalJsonNode | undefined;
  try {
    const parsed = JSON.parse(value) as { root?: LexicalJsonNode };
    root = parsed.root;
  } catch {
    return value.trim();
  }
  if (!root) return '';

  const parts: string[] = [];
  const walk = (node: LexicalJsonNode) => {
    if (typeof node.text === 'string' && node.text.length > 0) parts.push(node.text);
    node.children?.forEach(walk);
  };
  walk(root);

  return parts.join(' ').trim();
}

/** `extractFullText`, truncated for list/preview display. */
export function extractPlainText(value: string | null, maxLength = 120): string {
  const text = extractFullText(value);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
