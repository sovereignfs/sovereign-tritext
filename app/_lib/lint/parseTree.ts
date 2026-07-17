/** Simplified block-level shape of a Lexical document, for structural lint rules. */
export interface StructuralNode {
  type: string;
  /** Heading tag (`h1`, `h2`, …), present only when `type === 'heading'`. */
  tag?: string;
  children: StructuralNode[];
}

interface LexicalJsonNode {
  type?: string;
  tag?: string;
  children?: LexicalJsonNode[];
}

/**
 * Parses stored block content into its top-level structural nodes
 * (paragraph/heading/quote/list, not inline text runs) for cross-language
 * structural comparison. A pre-editor plain-text fallback (see schema.ts)
 * parses as a single implicit paragraph; empty/unparseable content is `[]`.
 */
export function parseStructure(value: string | null): StructuralNode[] {
  if (!value) return [];

  let root: LexicalJsonNode | undefined;
  try {
    const parsed = JSON.parse(value) as { root?: LexicalJsonNode };
    root = parsed.root;
  } catch {
    return value.trim() ? [{ type: 'paragraph', children: [] }] : [];
  }
  if (!root?.children) return [];

  return root.children.map(toStructuralNode);
}

function toStructuralNode(node: LexicalJsonNode): StructuralNode {
  return {
    type: node.type ?? 'unknown',
    tag: node.tag,
    children: (node.children ?? [])
      .filter((child) => child.type !== 'text')
      .map(toStructuralNode),
  };
}

/** `heading:h1`, `paragraph`, `list`, … — a comparable shape signature for one node. */
export function nodeKind(node: StructuralNode): string {
  return node.type === 'heading' ? `heading:${node.tag ?? '?'}` : node.type;
}

/** Human-readable description of a node's kind, for lint messages. */
export function describeNode(node: StructuralNode): string {
  return node.type === 'heading' ? `a ${node.tag ?? 'heading'}` : node.type;
}
