import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';

export const EDITOR_NODES: ReadonlyArray<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
];

export function onEditorError(error: Error): void {
  // Lexical requires a registered error boundary; log rather than throw so a
  // single broken editor instance doesn't take down the whole block editor page.
  console.error('[tritext] Lexical editor error', error);
}

function isSerializedEditorStateJson(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && 'root' in parsed;
  } catch {
    return false;
  }
}

/**
 * Stored content is either Lexical-serialized JSON, or plain text left over
 * from data that predates the rich-text editor (see schema.ts comment on
 * `sinhalaText`/`tamilText`/`englishText`). Returns a value usable directly
 * as LexicalComposer's `initialConfig.editorState`.
 */
export function toInitialEditorState(
  value: string | null,
): string | ((editor: LexicalEditor) => void) | undefined {
  if (!value) return undefined;
  if (isSerializedEditorStateJson(value)) return value;

  return () => {
    const root = $getRoot();
    if (root.getFirstChild() !== null) return;
    const paragraph = $createParagraphNode();
    paragraph.append($createTextNode(value));
    root.append(paragraph);
  };
}
