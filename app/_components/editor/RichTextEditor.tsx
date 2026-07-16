'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import type { EditorState, EditorThemeClasses } from 'lexical';
import { EDITOR_NODES, onEditorError, toInitialEditorState } from './editorConfig';
import { FloatingToolbarPlugin } from './FloatingToolbarPlugin';
import styles from './editor.module.css';

export interface RichTextEditorProps {
  /** Unique per editor instance (e.g. `${blockId}:${language}`). */
  namespace: string;
  ariaLabel: string;
  placeholder: string;
  initialValue: string | null;
  editable: boolean;
  onChange: (json: string) => void;
}

const theme: EditorThemeClasses = {
  paragraph: styles.paragraph,
  heading: { h1: styles.h1, h2: styles.h2 },
  quote: styles.quote,
  list: { ul: styles.ul, ol: styles.ol, listitem: styles.listItem },
  text: { bold: styles.textBold, italic: styles.textItalic, underline: styles.textUnderline },
};

function EditableSync({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

export function RichTextEditor({
  namespace,
  ariaLabel,
  placeholder,
  initialValue,
  editable,
  onChange,
}: RichTextEditorProps) {
  // `editorState` is read by Lexical only once, at mount — this instance is
  // recreated per block/language via a `key` on the parent (namespace),
  // never reused across different content.
  const initialConfig: InitialConfigType = useMemo(
    () => ({
      namespace,
      theme,
      nodes: [...EDITOR_NODES],
      editable,
      onError: onEditorError,
      editorState: toInitialEditorState(initialValue),
    }),
    [namespace],
  );

  const handleChange = useCallback(
    (editorState: EditorState) => {
      onChange(JSON.stringify(editorState.toJSON()));
    },
    [onChange],
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={styles.wrapper}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className={styles.contentEditable} aria-label={ariaLabel} />
          }
          placeholder={<div className={styles.placeholder}>{placeholder}</div>}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <ListPlugin />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
        <FloatingToolbarPlugin />
        <EditableSync editable={editable} />
      </div>
    </LexicalComposer>
  );
}
