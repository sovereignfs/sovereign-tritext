'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Input, Textarea, useToast } from '@sovereignfs/ui';
import { type CreateProjectResult, createProjectAction } from '../actions';
import styles from '../tritext.module.css';

export function CreateProjectForm() {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateProjectResult | null, FormData>(
    createProjectAction,
    null,
  );

  useEffect(() => {
    if (!state?.ok) return;
    toast.show({ title: 'Project created.', category: 'success' });
    router.push(`/tritext/${state.projectId}`);
  }, [state, toast, router]);

  return (
    <form action={action} className={styles.form}>
      <FormField label="Title" required>
        {(field) => <Input {...field} name="title" maxLength={200} />}
      </FormField>
      <FormField label="Description" hint="Optional">
        {(field) => <Textarea {...field} name="description" rows={2} />}
      </FormField>
      {state && !state.ok && (
        <p className={styles.feedbackError} role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'New project'}
      </Button>
    </form>
  );
}
