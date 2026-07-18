'use client';

import { type CSSProperties, useCallback, useRef, useState } from 'react';
import { Select, SplitPane, useToast } from '@sovereignfs/ui';
import type { Language } from '../_lib/access';
import { BLOCK_STATUSES, type BlockStatus, STATUS_LABEL } from '../_lib/blockStatus';
import {
  autosaveBlockContentAction,
  type BlockDetail,
  updateBlockLanguageStatusAction,
} from '../blocks-actions';
import editorStyles from './editor/editor.module.css';
import { RichTextEditor } from './editor/RichTextEditor';
import { LintPanel } from './LintPanel';
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

function LanguagePane({
  block,
  language,
  onLiveChange,
}: {
  block: BlockDetail;
  language: Language;
  onLiveChange: (language: Language, json: string) => void;
}) {
  const toast = useToast();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [status, setStatus] = useState<BlockStatus>(block.statusByLanguage[language]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editable = block.editableLanguages.includes(language);

  async function handleStatusChange(next: BlockStatus) {
    const previous = status;
    setStatus(next);
    const result = await updateBlockLanguageStatusAction(block.projectId, block.id, language, next);
    if (!result.ok) {
      setStatus(previous);
      toast.show({ title: result.error, category: 'error' });
    }
  }

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

  const handleChange = useCallback(
    (json: string) => {
      onLiveChange(language, json);
      scheduleSave(json);
    },
    [language, onLiveChange, scheduleSave],
  );

  return (
    <div className={styles.languagePane}>
      <div className={styles.languagePaneHeader}>
        <h2 className={styles.languagePaneTitle}>{LANGUAGE_LABEL[language]}</h2>
        <div className={styles.languagePaneHeaderRight}>
          <SaveStatusLabel state={saveState} />
          <Select
            size="sm"
            aria-label={`${LANGUAGE_LABEL[language]} status`}
            value={status}
            disabled={!editable}
            onChange={(e) => void handleStatusChange(e.target.value as BlockStatus)}
            className={styles.statusSelect}
          >
            {BLOCK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <RichTextEditor
        namespace={`${block.id}:${language}`}
        ariaLabel={`${LANGUAGE_LABEL[language]} content`}
        placeholder={editable ? `Write ${LANGUAGE_LABEL[language]} content…` : 'No content yet.'}
        initialValue={block.content[language]}
        editable={editable}
        onChange={handleChange}
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

  // Live mirror of every pane's latest content, fed to LintPanel — updated
  // on every editor change, ahead of the debounced autosave, since linting
  // is pure in-memory JS with no network round-trip to wait for.
  const [liveContent, setLiveContent] = useState<Record<Language, string | null>>(block.content);
  const handleLiveChange = useCallback((language: Language, json: string) => {
    setLiveContent((prev) => ({ ...prev, [language]: json }));
  }, []);

  const panes = (() => {
    if (languages.length >= 3) {
      return (
        <div
          className={styles.multiPane}
          style={{ '--tritext-pane-count': languages.length } as CSSProperties}
        >
          {languages.map((language) => (
            <LanguagePane
              key={language}
              block={block}
              language={language}
              onLiveChange={handleLiveChange}
            />
          ))}
        </div>
      );
    }

    if (languages.length === 2 && first && second) {
      return (
        <SplitPane
          primaryLabel={LANGUAGE_LABEL[first]}
          secondaryLabel={LANGUAGE_LABEL[second]}
          primary={<LanguagePane block={block} language={first} onLiveChange={handleLiveChange} />}
          secondary={
            <LanguagePane block={block} language={second} onLiveChange={handleLiveChange} />
          }
        />
      );
    }

    return (
      <div className={styles.singlePane}>
        {first && <LanguagePane block={block} language={first} onLiveChange={handleLiveChange} />}
      </div>
    );
  })();

  return (
    <div className={styles.blockEditorBody}>
      <LintPanel enabledLanguages={languages} content={liveContent} />
      {panes}
    </div>
  );
}
