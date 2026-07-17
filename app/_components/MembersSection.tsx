'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Checkbox, EmptyState, Select, useToast } from '@sovereignfs/ui';
import {
  inviteMemberAction,
  type MemberRole,
  type MemberSummary,
  type OwnerSummary,
  removeMemberAction,
  updateMemberAction,
} from '../members-actions';
import { InviteMemberForm } from './InviteMemberForm';
import styles from '../tritext.module.css';

function memberLabel(member: { displayName: string | null; email: string | null; userId: string }) {
  return member.displayName ?? member.email ?? member.userId;
}

function MemberRow({
  projectId,
  member,
  onChanged,
}: {
  projectId: string;
  member: MemberSummary;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [role, setRole] = useState(member.role);
  const [flags, setFlags] = useState({
    canEditSinhala: member.canEditSinhala,
    canEditTamil: member.canEditTamil,
    canEditEnglish: member.canEditEnglish,
  });
  const [removing, setRemoving] = useState(false);

  async function applyPatch(
    patch: Partial<{
      role: MemberRole;
      canEditSinhala: boolean;
      canEditTamil: boolean;
      canEditEnglish: boolean;
    }>,
  ) {
    const result = await updateMemberAction(projectId, member.userId, patch);
    if (!result.ok) {
      toast.show({ title: result.error, category: 'error' });
      return;
    }
    onChanged();
  }

  async function handleRemove() {
    setRemoving(true);
    const result = await removeMemberAction(projectId, member.userId);
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
        <strong>{memberLabel(member)}</strong>
        {member.displayName && member.email && (
          <p className={styles.memberEmail}>{member.email}</p>
        )}
      </div>
      <Select
        size="sm"
        aria-label={`Role for ${memberLabel(member)}`}
        value={role}
        onChange={(event) => {
          const next = event.target.value as MemberRole;
          setRole(next);
          void applyPatch({ role: next });
        }}
      >
        <option value="viewer">Viewer</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </Select>
      {role === 'editor' && (
        <div className={styles.memberLanguageFlags}>
          <Checkbox
            id={`member-${member.userId}-can-edit-sinhala`}
            label="Si"
            checked={flags.canEditSinhala}
            onChange={(checked) => {
              setFlags((prev) => ({ ...prev, canEditSinhala: checked }));
              void applyPatch({ canEditSinhala: checked });
            }}
          />
          <Checkbox
            id={`member-${member.userId}-can-edit-tamil`}
            label="Ta"
            checked={flags.canEditTamil}
            onChange={(checked) => {
              setFlags((prev) => ({ ...prev, canEditTamil: checked }));
              void applyPatch({ canEditTamil: checked });
            }}
          />
          <Checkbox
            id={`member-${member.userId}-can-edit-english`}
            label="En"
            checked={flags.canEditEnglish}
            onChange={(checked) => {
              setFlags((prev) => ({ ...prev, canEditEnglish: checked }));
              void applyPatch({ canEditEnglish: checked });
            }}
          />
        </div>
      )}
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

export function MembersSection({
  projectId,
  owner,
  members,
  canManage,
  directoryLookupFailed,
}: {
  projectId: string;
  owner: OwnerSummary;
  members: MemberSummary[];
  canManage: boolean;
  directoryLookupFailed: boolean;
}) {
  const router = useRouter();
  function refresh() {
    router.refresh();
  }

  return (
    <section className={styles.blocksSection}>
      <div className={styles.blocksSectionHeader}>
        <h2 className={styles.sectionTitle}>People</h2>
      </div>
      {directoryLookupFailed && (
        <p className={styles.feedbackError} role="alert">
          Couldn&apos;t load names and emails right now. Showing IDs only.
        </p>
      )}
      <p className={styles.ownerLine}>Owner: {memberLabel(owner)}</p>
      {members.length === 0 ? (
        <EmptyState
          heading="No collaborators yet"
          description={canManage ? 'Add someone below.' : 'Only the owner has access.'}
        />
      ) : (
        <div className={styles.memberList}>
          {members.map((member) =>
            canManage ? (
              <MemberRow
                key={member.userId}
                projectId={projectId}
                member={member}
                onChanged={refresh}
              />
            ) : (
              <div key={member.userId} className={styles.memberRow}>
                <div className={styles.memberIdentity}>
                  <strong>{memberLabel(member)}</strong>
                </div>
                <span className={styles.memberRoleLabel}>{member.role}</span>
              </div>
            ),
          )}
        </div>
      )}
      {canManage && (
        <InviteMemberForm projectId={projectId} action={inviteMemberAction.bind(null, projectId)} />
      )}
    </section>
  );
}
