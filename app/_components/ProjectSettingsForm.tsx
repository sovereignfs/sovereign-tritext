'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button, Checkbox, FormField, Input, Select, Textarea, useToast } from '@sovereignfs/ui';
import {
  type ProjectDetail,
  type UpdateProjectSettingsResult,
  updateProjectSettingsAction,
} from '../actions';
import styles from '../tritext.module.css';

const LANGUAGES = [
  { value: 'sinhala', label: 'Sinhala' },
  { value: 'tamil', label: 'Tamil' },
  { value: 'english', label: 'English' },
] as const;

export function ProjectSettingsForm({ project }: { project: ProjectDetail }) {
  const toast = useToast();
  const [enabled, setEnabled] = useState<ReadonlySet<string>>(new Set(project.enabledLanguages));
  const [state, action, pending] = useActionState<UpdateProjectSettingsResult | null, FormData>(
    updateProjectSettingsAction,
    null,
  );
  const canEdit = project.viewerRole === 'owner' || project.viewerRole === 'admin';

  useEffect(() => {
    if (state?.ok) toast.show({ title: state.message, category: 'success' });
  }, [state, toast]);

  const deadlineValue = project.deadline
    ? new Date(project.deadline * 1000).toISOString().slice(0, 10)
    : '';

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="projectId" value={project.id} />
      <FormField label="Title" required>
        {(field) => (
          <Input
            {...field}
            name="title"
            maxLength={200}
            defaultValue={project.title}
            disabled={!canEdit}
          />
        )}
      </FormField>
      <FormField label="Description" hint="Optional">
        {(field) => (
          <Textarea
            {...field}
            name="description"
            rows={3}
            defaultValue={project.description ?? ''}
            disabled={!canEdit}
          />
        )}
      </FormField>
      <FormField label="Deadline" hint="Optional">
        {(field) => (
          <Input
            {...field}
            name="deadline"
            type="date"
            defaultValue={deadlineValue}
            disabled={!canEdit}
          />
        )}
      </FormField>
      <FormField label="Language mode">
        {(field) => (
          <Select
            {...field}
            name="languageMode"
            defaultValue={project.languageMode}
            disabled={!canEdit}
          >
            <option value="monolingual">Monolingual</option>
            <option value="bilingual">Bilingual</option>
            <option value="trilingual">Trilingual</option>
          </Select>
        )}
      </FormField>
      <fieldset className={styles.languageFieldset} disabled={!canEdit}>
        <legend className={styles.languageLegend}>Enabled languages</legend>
        {LANGUAGES.map((lang) => (
          <Checkbox
            key={lang.value}
            name="enabledLanguages"
            value={lang.value}
            label={lang.label}
            checked={enabled.has(lang.value)}
            disabled={!canEdit}
            onChange={(checked) => {
              setEnabled((prev) => {
                const next = new Set(prev);
                if (checked) next.add(lang.value);
                else next.delete(lang.value);
                return next;
              });
            }}
          />
        ))}
      </fieldset>
      <FormField label="Primary language">
        {(field) => (
          <Select
            {...field}
            name="primaryLanguage"
            defaultValue={project.primaryLanguage}
            disabled={!canEdit}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      {state && !state.ok && (
        <p className={styles.feedbackError} role="alert">
          {state.error}
        </p>
      )}
      {canEdit && (
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      )}
    </form>
  );
}
