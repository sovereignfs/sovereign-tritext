import { HeadingLevel, Paragraph, TextRun } from 'docx';

interface LexicalJsonTextNode {
  type: 'text';
  text: string;
  format?: number;
}

interface LexicalJsonElementNode {
  type: string;
  tag?: string;
  children?: LexicalJsonNode[];
}

type LexicalJsonNode = LexicalJsonTextNode | LexicalJsonElementNode;

// Lexical's TextNode format bitmask (see lexical/LexicalConstants) — only the
// three bits this plugin's own toolbar can ever set are handled.
const FORMAT_BOLD = 1;
const FORMAT_ITALIC = 2;
const FORMAT_UNDERLINE = 8;

function isTextNode(node: LexicalJsonNode): node is LexicalJsonTextNode {
  return node.type === 'text';
}

function textRuns(children: LexicalJsonNode[] | undefined): TextRun[] {
  if (!children) return [];
  return children.filter(isTextNode).map((node) => {
    const format = node.format ?? 0;
    return new TextRun({
      text: node.text,
      bold: (format & FORMAT_BOLD) !== 0,
      italics: (format & FORMAT_ITALIC) !== 0,
      underline: (format & FORMAT_UNDERLINE) !== 0 ? {} : undefined,
    });
  });
}

/**
 * Converts stored block content (Lexical-serialized JSON, or a pre-editor
 * plain-text fallback — see schema.ts) into `docx` paragraphs, preserving
 * headings, quotes, lists, and bold/italic/underline runs.
 */
export function lexicalJsonToParagraphs(value: string | null): Paragraph[] {
  if (!value) return [];

  let root: LexicalJsonElementNode | undefined;
  try {
    const parsed = JSON.parse(value) as { root?: LexicalJsonElementNode };
    root = parsed.root;
  } catch {
    const trimmed = value.trim();
    return trimmed ? [new Paragraph({ children: [new TextRun(trimmed)] })] : [];
  }
  if (!root?.children) return [];

  return root.children.flatMap((node) => nodeToParagraphs(node, 0));
}

function nodeToParagraphs(node: LexicalJsonNode, bulletLevel: number): Paragraph[] {
  if (isTextNode(node)) return [];

  switch (node.type) {
    case 'heading':
      return [
        new Paragraph({
          heading: node.tag === 'h1' ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: textRuns(node.children),
        }),
      ];
    case 'quote':
      // Indented rather than a referenced built-in Word style — keeps the
      // generated Document self-contained, with no style table to define.
      return [new Paragraph({ children: textRuns(node.children), indent: { left: 720 } })];
    case 'list':
      return (node.children ?? []).flatMap((child) => nodeToParagraphs(child, bulletLevel));
    case 'listitem': {
      const children = node.children ?? [];
      const nestedLists = children.filter(
        (child): child is LexicalJsonElementNode => !isTextNode(child) && child.type === 'list',
      );
      const paragraphs = [new Paragraph({ children: textRuns(children), bullet: { level: bulletLevel } })];
      for (const nestedList of nestedLists) {
        paragraphs.push(...nodeToParagraphs(nestedList, bulletLevel + 1));
      }
      return paragraphs;
    }
    default:
      return [new Paragraph({ children: textRuns(node.children) })];
  }
}
