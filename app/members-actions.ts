'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { sdk } from '@sovereignfs/sdk';
import type { DirectoryUser } from '@sovereignfs/sdk';
import { getDb, nowSeconds, resolveAccess } from './_lib/access';
import { projectMembers } from './_lib/db/schema';
import { notifyUser } from './_lib/notify';

export type MemberRole = 'admin' | 'editor' | 'viewer';

const MEMBER_ROLES = new Set<MemberRole>(['admin', 'editor', 'viewer']);

function isMemberRole(value: string | null): value is MemberRole {
  return value !== null && MEMBER_ROLES.has(value as MemberRole);
}

function canManageMembers(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

export interface MemberSummary {
  userId: string;
  role: MemberRole;
  canEditSinhala: boolean;
  canEditTamil: boolean;
  canEditEnglish: boolean;
  displayName: string | null;
  email: string | null;
}

export interface OwnerSummary {
  userId: string;
  displayName: string | null;
  email: string | null;
}

export interface ProjectMembers {
  owner: OwnerSummary;
  members: MemberSummary[];
  canManage: boolean;
  /** True if `sdk.directory.resolveUsers` failed — members render by id only. */
  directoryLookupFailed: boolean;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMembers | null> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return null;

  const rows = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.tenantId, session.user.tenantId),
      ),
    );

  const ownerUserId = access.project.ownerUserId;
  let directory: DirectoryUser[] = [];
  let directoryLookupFailed = false;
  try {
    directory = await sdk.directory.resolveUsers({
      ids: [ownerUserId, ...rows.map((row) => row.userId)],
    });
  } catch {
    directoryLookupFailed = true;
  }
  const byId = new Map(directory.map((user) => [user.id, user]));
  const ownerUser = byId.get(ownerUserId);

  return {
    owner: {
      userId: ownerUserId,
      displayName: ownerUser?.name ?? null,
      email: ownerUser?.email ?? null,
    },
    members: rows.map((row) => {
      const user = byId.get(row.userId);
      return {
        userId: row.userId,
        role: row.role as MemberRole,
        canEditSinhala: row.canEditSinhala,
        canEditTamil: row.canEditTamil,
        canEditEnglish: row.canEditEnglish,
        displayName: user?.name ?? null,
        email: user?.email ?? null,
      };
    }),
    canManage: canManageMembers(access.role),
    directoryLookupFailed,
  };
}

/** Gated by any project access — backs the invite form's own search box. */
export async function searchProjectDirectoryUsers(
  projectId: string,
  query: string,
): Promise<DirectoryUser[]> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return [];
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  return sdk.directory.searchUsers({ query: trimmed, limit: 8 });
}

export type MemberActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function inviteMemberAction(
  projectId: string,
  _prev: MemberActionResult | null,
  formData: FormData,
): Promise<MemberActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageMembers(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can add people.' };
  }

  const invitedUserId = (formData.get('userId') as string | null) ?? '';
  const role = formData.get('role') as string | null;
  if (!invitedUserId) return { ok: false, error: 'Choose a person to add.' };
  if (!isMemberRole(role)) return { ok: false, error: 'Invalid role.' };
  if (invitedUserId === access.project.ownerUserId) {
    return { ok: false, error: 'The project owner already has full access.' };
  }

  // Resolve against the platform directory before inserting a membership
  // row — otherwise a stale/spoofed id silently creates a phantom member
  // that can never resolve to a real display name (see CLAUDE.md's
  // Collaborator model: no in-plugin invite-by-email, only existing users).
  const [invitedUser] = await sdk.directory.resolveUsers({ ids: [invitedUserId] });
  if (!invitedUser) return { ok: false, error: 'That person could not be found.' };

  const canEditSinhala = formData.get('canEditSinhala') === 'on';
  const canEditTamil = formData.get('canEditTamil') === 'on';
  const canEditEnglish = formData.get('canEditEnglish') === 'on';

  const [existing] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, invitedUserId)))
    .limit(1);

  if (existing) {
    await db
      .update(projectMembers)
      .set({ role, canEditSinhala, canEditTamil, canEditEnglish })
      .where(eq(projectMembers.id, existing.id));
  } else {
    await db.insert(projectMembers).values({
      id: randomUUID(),
      tenantId: session.user.tenantId,
      projectId,
      userId: invitedUserId,
      role,
      canEditSinhala,
      canEditTamil,
      canEditEnglish,
      invitedAt: nowSeconds(),
      invitedBy: session.user.id,
    });

    await notifyUser({
      recipientUserId: invitedUserId,
      title: 'Added to a Tritext project',
      body: `You were added to "${access.project.title}" as ${role}.`,
      url: `/tritext/${projectId}`,
    });
  }

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: `Added ${invitedUser.name ?? invitedUser.email} as ${role}.` };
}

/** Called directly from the client (not via `useActionState`) for inline role/permission edits. */
export async function updateMemberAction(
  projectId: string,
  memberUserId: string,
  patch: Partial<
    Pick<MemberSummary, 'role' | 'canEditSinhala' | 'canEditTamil' | 'canEditEnglish'>
  >,
): Promise<MemberActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageMembers(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can change members.' };
  }

  await db
    .update(projectMembers)
    .set(patch)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberUserId)),
    );

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: 'Updated.' };
}

export async function removeMemberAction(
  projectId: string,
  memberUserId: string,
): Promise<MemberActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageMembers(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can remove members.' };
  }

  await db
    .delete(projectMembers)
    .where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, memberUserId)),
    );

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: 'Removed.' };
}
