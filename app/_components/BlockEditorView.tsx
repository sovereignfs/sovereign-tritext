'use client';

import { type CSSProperties, useCallback, useRef, useState } from 'react';
import { SplitPane } from '@sovereignfs/ui';
import type { Language } from '../_lib/access';
import { autosaveBlockContentAction, type BlockDetail } from '../blocks-actions';
import editorStyles from './editor/editor.module.css';
import { RichTextEditor } from './editor/RichTextEditor';
import styles from '../tritext.module.css';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 800;

function SaveStatusLabel({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const text = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Could not save';
  return (
    <span
      className={[editorStyles.saveStatus, state === 'error' && editorStyles.saveStatusError]
        .filter(Boolean)
        .join(' ')}
    >
      {text}
    </span>
  );
}

function LanguagePane({ block, language }: { block: BlockDetail; language: Language }) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = block.editableLanguages.includes(language);

  const scheduleSave = useCallback(
    (json: string) => {
      setSaveState('saving');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void autosaveBlockContentAction(block.projectId, block.id, language, json).then(
          (result) => setSaveState(result.ok ? 'saved' : 'error'),
        );
      }, AUTOSAVE_DELAY_MS);
    },
    [block.id, block.projectId, language],
  );

  return (
    <div className={styles.languagePane}>
      <div className={styles.languagePaneHeader}>
        <h2 className={styles.languagePaneTitle}>{LANGUAGE_LABEL[language]}</h2>
        <SaveStatusLabel state={saveState} />
      </div>
      <RichTextEditor
        namespace={`${block.id}:${language}`}
        ariaLabel={`${LANGUAGE_LABEL[language]} content`}
        placeholder={editable ? `Write ${LANGUAGE_LABEL[language]} content…` : 'No content yet.'}
        initialValue={block.content[language]}
        editable={editable}
        onChange={scheduleSave}
      />
    </div>
  );
}

/** Per-language editing surface for one content block: 1 pane, a resizable
 * 2-pane split, or an equal-width grid for 3+ enabled languages. */
export function BlockEditorView({ block }: { block: BlockDetail }) {
  const languages = block.enabledLanguages;
  const first = languages[0];
  const second = languages[1];

  if (languages.length >= 3) {
    return (
      <div
        className={styles.multiPane}
        style={{ '--tritext-pane-count': languages.length } as CSSProperties}
      >
        {languages.map((language) => (
          <LanguagePane key={language} block={block} language={language} />
        ))}
      </div>
    );
  }

  if (languages.length === 2 && first && second) {
    return (
      <SplitPane
        primaryLabel={LANGUAGE_LABEL[first]}
        secondaryLabel={LANGUAGE_LABEL[second]}
        primary={<LanguagePane block={block} language={first} />}
        secondary={<LanguagePane block={block} language={second} />}
      />
    );
  }

  return (
    <div className={styles.singlePane}>
      {first && <LanguagePane block={block} language={first} />}
    </div>
  );
}
