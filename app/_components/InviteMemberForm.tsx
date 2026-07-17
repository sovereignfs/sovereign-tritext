'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, Checkbox, FormField, Input, Select, useToast } from '@sovereignfs/ui';
import type { DirectoryUser } from '@sovereignfs/sdk';
import {
  type MemberActionResult,
  type MemberRole,
  searchProjectDirectoryUsers,
} from '../members-actions';
import styles from '../tritext.module.css';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

/**
 * Name/email typeahead backed by `sdk.directory.searchUsers`, resolving to
 * an id only once a real directory match is picked — never a raw "paste a
 * user id" field (see CLAUDE.md's Collaborator model: no in-plugin
 * invite-by-email, only existing platform users).
 */
export function InviteMemberForm({
  projectId,
  action,
}: {
  projectId: string;
  action: (
    prevState: MemberActionResult | null,
    formData: FormData,
  ) => Promise<MemberActionResult>;
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState<MemberActionResult | null, FormData>(
    action,
    null,
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const [selected, setSelected] = useState<DirectoryUser | null>(null);
  const [role, setRole] = useState<MemberRole>('viewer');
  const [canEditSinhala, setCanEditSinhala] = useState(false);
  const [canEditTamil, setCanEditTamil] = useState(false);
  const [canEditEnglish, setCanEditEnglish] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (selected || query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchProjectDirectoryUsers(projectId, query.trim())
        .then((users) => {
          if (!cancelled) setResults(users);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, selected, projectId]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.show({ title: state.message, category: 'success' });
      setSelected(null);
      setQuery('');
      setResults([]);
      setRole('viewer');
      setCanEditSinhala(false);
      setCanEditTamil(false);
      setCanEditEnglish(false);
      formRef.current?.reset();
    } else {
      toast.show({ title: state.error, category: 'error' });
    }
  }, [state, toast]);

  return (
    <form ref={formRef} action={formAction} className={styles.inviteForm}>
      <input type="hidden" name="userId" value={selected?.id ?? ''} />
      <FormField label="Person" hint={selected ? undefined : 'Search by name or email'}>
        {(field) => (
          <div className={styles.memberPicker}>
            <Input
              {...field}
              value={selected ? (selected.name ?? selected.email) : query}
              onChange={(event) => {
                setSelected(null);
                setQuery(event.currentTarget.value);
              }}
              placeholder="Search by name or email"
              autoComplete="off"
            />
            {results.length > 0 && !selected && (
              <ul className={styles.memberResults}>
                {results.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(user);
                        setResults([]);
                      }}
                    >
                      {user.name ?? user.email}
                      {user.name ? ` (${user.email})` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </FormField>
      <FormField label="Role">
        {(field) => (
          <Select
            {...field}
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as MemberRole)}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </Select>
        )}
      </FormField>
      {role === 'editor' && (
        <fieldset className={styles.languageFieldset}>
          <legend className={styles.languageLegend}>Can edit</legend>
          <Checkbox
            id="invite-can-edit-sinhala"
            name="canEditSinhala"
            label="Sinhala"
            checked={canEditSinhala}
            onChange={setCanEditSinhala}
          />
          <Checkbox
            id="invite-can-edit-tamil"
            name="canEditTamil"
            label="Tamil"
            checked={canEditTamil}
            onChange={setCanEditTamil}
          />
          <Checkbox
            id="invite-can-edit-english"
            name="canEditEnglish"
            label="English"
            checked={canEditEnglish}
            onChange={setCanEditEnglish}
          />
        </fieldset>
      )}
      <Button type="submit" disabled={!selected || pending}>
        {pending ? 'Adding…' : 'Add person'}
      </Button>
    </form>
  );
}
