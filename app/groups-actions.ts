'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { sdk } from '@sovereignfs/sdk';
import { getDb, nowSeconds, resolveAccess } from './_lib/access';
import {
  type BlockSummary,
  groupIdCondition,
  nextOrderInBucket,
  toBlockSummary,
} from './_lib/blockSummary';
import { contentBlockGroups, contentBlocks } from './_lib/db/schema';

export interface GroupSummary {
  id: string;
  name: string;
  orderNumber: number;
  isCollapsed: boolean;
  blocks: BlockSummary[];
}

export interface ProjectContent {
  groups: GroupSummary[];
  ungroupedBlocks: BlockSummary[];
}

/** Every group and block in a project, assembled server-side in two queries. */
export async function getProjectContent(projectId: string): Promise<ProjectContent | null> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return null;

  const [groupRows, blockRows] = await Promise.all([
    db.select().from(contentBlockGroups).where(eq(contentBlockGroups.projectId, projectId)),
    db.select().from(contentBlocks).where(eq(contentBlocks.projectId, projectId)),
  ]);

  const blocksByGroup = new Map<string | null, BlockSummary[]>();
  for (const row of blockRows) {
    const key = row.groupId;
    const list = blocksByGroup.get(key) ?? [];
    list.push(toBlockSummary(row, access));
    blocksByGroup.set(key, list);
  }
  for (const list of blocksByGroup.values()) list.sort((a, b) => a.orderNumber - b.orderNumber);

  const groups = groupRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      orderNumber: row.orderNumber,
      isCollapsed: row.isCollapsed,
      blocks: blocksByGroup.get(row.id) ?? [],
    }))
    .sort((a, b) => a.orderNumber - b.orderNumber);

  return { groups, ungroupedBlocks: blocksByGroup.get(null) ?? [] };
}

export type GroupActionResult = { ok: true; groupId: string } | { ok: false; error: string };

export async function createGroupAction(
  _prev: GroupActionResult | null,
  formData: FormData,
): Promise<GroupActionResult> {
  const session = await sdk.auth.requireSession();
  const projectId = (formData.get('projectId') as string | null) ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!projectId) return { ok: false, error: 'Missing project.' };
  if (!name) return { ok: false, error: 'Group name is required.' };
  if (name.length > 200) {
    return { ok: false, error: 'Group name must be 200 characters or fewer.' };
  }

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot add groups.' };

  const existing = await db
    .select({ orderNumber: contentBlockGroups.orderNumber })
    .from(contentBlockGroups)
    .where(eq(contentBlockGroups.projectId, projectId));
  const nextOrder = existing.reduce((max, row) => Math.max(max, row.orderNumber), -1) + 1;

  const id = randomUUID();
  const now = nowSeconds();
  await db.insert(contentBlockGroups).values({
    id,
    tenantId: session.user.tenantId,
    projectId,
    name,
    orderNumber: nextOrder,
    isCollapsed: false,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, groupId: id };
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

export async function renameGroupAction(
  _prev: SimpleResult | null,
  formData: FormData,
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const projectId = (formData.get('projectId') as string | null) ?? '';
  const groupId = (formData.get('groupId') as string | null) ?? '';
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  if (!projectId || !groupId) return { ok: false, error: 'Missing group.' };
  if (!name) return { ok: false, error: 'Group name is required.' };
  if (name.length > 200) {
    return { ok: false, error: 'Group name must be 200 characters or fewer.' };
  }

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot rename groups.' };

  await db
    .update(contentBlockGroups)
    .set({ name, updatedAt: nowSeconds() })
    .where(and(eq(contentBlockGroups.id, groupId), eq(contentBlockGroups.projectId, projectId)));

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true };
}

/** Deletes a group and moves its blocks back to the ungrouped bucket — never deletes content. */
export async function deleteGroupAction(
  _prev: SimpleResult | null,
  formData: FormData,
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const projectId = (formData.get('projectId') as string | null) ?? '';
  const groupId = (formData.get('groupId') as string | null) ?? '';
  if (!projectId || !groupId) return { ok: false, error: 'Missing group.' };

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot delete groups.' };

  const now = nowSeconds();
  const ungroupedOrderStart = await nextOrderInBucket(db, projectId, null);
  const blocksToUngroup = await db
    .select({ id: contentBlocks.id })
    .from(contentBlocks)
    .where(and(eq(contentBlocks.groupId, groupId), eq(contentBlocks.projectId, projectId)));

  // better-sqlite3 transactions are synchronous — the callback must not be
  // async, or the COMMIT fires before an awaited body finishes.
  db.transaction((tx) => {
    blocksToUngroup.forEach((block, index) => {
      tx.update(contentBlocks)
        .set({ groupId: null, orderNumber: ungroupedOrderStart + index, updatedAt: now })
        .where(eq(contentBlocks.id, block.id))
        .run();
    });
    tx.delete(contentBlockGroups)
      .where(and(eq(contentBlockGroups.id, groupId), eq(contentBlockGroups.projectId, projectId)))
      .run();
  });

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true };
}

/**
 * Called directly from the client, not via `useActionState`. Collapsing is
 * shared view state stored on the group row, not a content edit — any role
 * with project access (including viewer) may toggle it.
 */
export async function toggleGroupCollapsedAction(
  projectId: string,
  groupId: string,
  isCollapsed: boolean,
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };

  await db
    .update(contentBlockGroups)
    .set({ isCollapsed, updatedAt: nowSeconds() })
    .where(and(eq(contentBlockGroups.id, groupId), eq(contentBlockGroups.projectId, projectId)));

  return { ok: true };
}

/** Called directly from the client after a `dnd-kit` drag ends on the groups list. */
export async function reorderGroupsAction(
  projectId: string,
  orderedGroupIds: string[],
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot reorder groups.' };

  const now = nowSeconds();
  db.transaction((tx) => {
    orderedGroupIds.forEach((groupId, index) => {
      tx.update(contentBlockGroups)
        .set({ orderNumber: index, updatedAt: now })
        .where(
          and(eq(contentBlockGroups.id, groupId), eq(contentBlockGroups.projectId, projectId)),
        )
        .run();
    });
  });

  return { ok: true };
}

/** Called directly from the client after a `dnd-kit` drag ends within one group's block list. */
export async function reorderBlocksAction(
  projectId: string,
  groupId: string | null,
  orderedBlockIds: string[],
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot reorder blocks.' };

  const now = nowSeconds();
  db.transaction((tx) => {
    orderedBlockIds.forEach((blockId, index) => {
      tx.update(contentBlocks)
        .set({ orderNumber: index, updatedAt: now })
        .where(and(eq(contentBlocks.id, blockId), groupIdCondition(projectId, groupId)))
        .run();
    });
  });

  return { ok: true };
}

/** Moves a block into a different group (or back to ungrouped), appending it to that bucket. */
export async function moveBlockToGroupAction(
  projectId: string,
  blockId: string,
  groupId: string | null,
): Promise<SimpleResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot move blocks.' };

  const nextOrder = await nextOrderInBucket(db, projectId, groupId);
  await db
    .update(contentBlocks)
    .set({ groupId, orderNumber: nextOrder, updatedAt: nowSeconds() })
    .where(and(eq(contentBlocks.id, blockId), eq(contentBlocks.projectId, projectId)));

  return { ok: true };
}
