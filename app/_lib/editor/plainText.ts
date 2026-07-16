interface LexicalJsonNode {
  text?: string;
  children?: LexicalJsonNode[];
}

/**
 * Best-effort plain-text preview of stored block content — either
 * Lexical-serialized JSON or a pre-editor plain-text fallback (see
 * schema.ts). Used for block list previews only, never round-tripped back
 * into the editor.
 */
export function extractPlainText(value: string | null, maxLength = 120): string {
  if (!value) return '';

  let root: LexicalJsonNode | undefined;
  try {
    const parsed = JSON.parse(value) as { root?: LexicalJsonNode };
    root = parsed.root;
  } catch {
    return truncate(value, maxLength);
  }
  if (!root) return '';

  const parts: string[] = [];
  const walk = (node: LexicalJsonNode) => {
    if (typeof node.text === 'string' && node.text.length > 0) parts.push(node.text);
    node.children?.forEach(walk);
  };
  walk(root);

  return truncate(parts.join(' ').trim(), maxLength);
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
