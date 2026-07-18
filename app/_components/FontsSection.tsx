'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, EmptyState, FormField, Input, useToast } from '@sovereignfs/ui';
import type { Language } from '../_lib/access';
import {
  deleteFontAction,
  type FontActionResult,
  type FontSummary,
  toggleFontActiveAction,
  uploadFontAction,
} from '../fonts-actions';
import styles from '../tritext.module.css';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

const SCRIPT_OPTIONS: Language[] = ['sinhala', 'tamil', 'english'];

function FontRow({
  projectId,
  font,
  onChanged,
}: {
  projectId: string;
  font: FontSummary;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [active, setActive] = useState(font.isActive);
  const [removing, setRemoving] = useState(false);

  async function handleToggle(checked: boolean) {
    setActive(checked);
    const result = await toggleFontActiveAction(projectId, font.id, checked);
    if (!result.ok) {
      toast.show({ title: result.error, category: 'error' });
      setActive(!checked);
      return;
    }
    onChanged();
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await deleteFontAction(projectId, font.id);
    setRemoving(false);
    if (!result.ok) {
      toast.show({ title: result.error, category: 'error' });
      return;
    }
    onChanged();
  }

  return (
    <div className={styles.memberRow}>
      <div className={styles.memberIdentity}>
        <strong>{font.displayName}</strong>
        <p className={styles.memberEmail}>
          {font.supportedScripts.map((lang) => LANGUAGE_LABEL[lang]).join(', ')}
        </p>
      </div>
      <Checkbox
        id={`font-${font.id}-active`}
        label="Active"
        checked={active}
        onChange={(checked) => void handleToggle(checked)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={removing}
        onClick={() => void handleRemove()}
      >
        {removing ? 'Removing…' : 'Remove'}
      </Button>
    </div>
  );
}

function UploadFontForm({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const boundAction = uploadFontAction.bind(null, projectId);
  const [state, formAction, pending] = useActionState<FontActionResult | null, FormData>(
    boundAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [scripts, setScripts] = useState<ReadonlySet<Language>>(new Set());

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.show({ title: state.message, category: 'success' });
      formRef.current?.reset();
      setScripts(new Set());
      onUploaded();
    } else {
      toast.show({ title: state.error, category: 'error' });
    }
  }, [state, toast, onUploaded]);

  return (
    <form ref={formRef} action={formAction} className={styles.uploadForm}>
      <FormField label="Font file" hint=".woff2, .woff, .ttf, or .otf — max 5 MB">
        {(field) => (
          <input
            {...field}
            type="file"
            name="file"
            accept=".woff2,.woff,.ttf,.otf"
            required
            className={styles.fileInput}
          />
        )}
      </FormField>
      <FormField label="Family name" hint="CSS font-family — letters, numbers, spaces, - or _">
        {(field) => <Input {...field} name="familyName" required />}
      </FormField>
      <FormField label="Display name">
        {(field) => <Input {...field} name="displayName" required />}
      </FormField>
      <fieldset className={styles.languageFieldset}>
        <legend className={styles.languageLegend}>Scripts</legend>
        {SCRIPT_OPTIONS.map((lang) => (
          <Checkbox
            key={lang}
            id={`upload-script-${lang}`}
            name="supportedScripts"
            value={lang}
            label={LANGUAGE_LABEL[lang]}
            checked={scripts.has(lang)}
            onChange={(checked) => {
              setScripts((prev) => {
                const next = new Set(prev);
                if (checked) next.add(lang);
                else next.delete(lang);
                return next;
              });
            }}
          />
        ))}
      </fieldset>
      <Button type="submit" size="sm" disabled={pending} className={styles.uploadFormSubmit}>
        {pending ? 'Uploading…' : 'Upload font'}
      </Button>
    </form>
  );
}

export function FontsSection({
  projectId,
  fonts,
  canManage,
}: {
  projectId: string;
  fonts: FontSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  function refresh() {
    router.refresh();
  }

  if (!canManage && fonts.length === 0) return null;

  return (
    <section className={styles.blocksSection}>
      <div className={styles.blocksSectionHeader}>
        <h2 className={styles.sectionTitle}>Fonts</h2>
      </div>
      {fonts.length === 0 ? (
        <EmptyState
          heading="No custom fonts yet"
          description="Upload a webfont for Sinhala or Tamil below."
        />
      ) : (
        <div className={styles.memberList}>
          {fonts.map((font) =>
            canManage ? (
              <FontRow key={font.id} projectId={projectId} font={font} onChanged={refresh} />
            ) : (
              <div key={font.id} className={styles.memberRow}>
                <div className={styles.memberIdentity}>
                  <strong>{font.displayName}</strong>
                </div>
              </div>
            ),
          )}
        </div>
      )}
      {canManage && <UploadFontForm projectId={projectId} onUploaded={refresh} />}
    </section>
  );
}
