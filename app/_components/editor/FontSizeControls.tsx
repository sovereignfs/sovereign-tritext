'use client';

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $patchStyleText } from '@lexical/selection';
import { $getSelection, $isRangeSelection } from 'lexical';
import { $readFontSize, FONT_SIZE_STEP, MAX_FONT_SIZE, MIN_FONT_SIZE } from './fontSize';
import styles from './editor.module.css';

/** +/- font-size stepper for the current selection, shown in the floating toolbar. */
export function FontSizeControls({ fontSize }: { fontSize: number }) {
  const [editor] = useLexicalComposerContext();

  const applyDelta = (delta: number) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const current = $readFontSize();
      const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, current + delta));
      $patchStyleText(selection, { 'font-size': `${next}px` });
    });
  };

  return (
    <span className={styles.fontSizeControls}>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label="Decrease font size"
        disabled={fontSize <= MIN_FONT_SIZE}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyDelta(-FONT_SIZE_STEP)}
      >
        −
      </button>
      <span className={styles.fontSizeValue}>{fontSize}</span>
      <button
        type="button"
        className={styles.toolbarButton}
        aria-label="Increase font size"
        disabled={fontSize >= MAX_FONT_SIZE}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => applyDelta(FONT_SIZE_STEP)}
      >
        +
      </button>
    </span>
  );
}
