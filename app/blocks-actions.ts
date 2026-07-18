'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { sdk } from '@sovereignfs/sdk';
import { canEditLanguage, getDb, type Language, nowSeconds, resolveAccess } from './_lib/access';
import { aggregateStatus, BLOCK_STATUSES, type BlockStatus } from './_lib/blockStatus';
import { nextOrderInBucket } from './_lib/blockSummary';
import { contentBlocks } from './_lib/db/schema';

export type { BlockStatus };

export interface BlockDetail {
  id: string;
  projectId: string;
  blockType: string;
  status: string;
  statusByLanguage: Record<Language, BlockStatus>;
  content: Record<Language, string | null>;
  /** Languages the current viewer may edit — a subset of `enabledLanguages`. */
  editableLanguages: Language[];
  enabledLanguages: Language[];
}

export async function getBlock(projectId: string, blockId: string): Promise<BlockDetail | null> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return null;

  const [row] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.id, blockId), eq(contentBlocks.projectId, projectId)))
    .limit(1);
  if (!row) return null;

  const enabledLanguages = JSON.parse(access.project.enabledLanguages) as Language[];
  const editableLanguages = enabledLanguages.filter((language) =>
    canEditLanguage(access, language),
  );

  return {
    id: row.id,
    projectId,
    blockType: row.blockType,
    status: row.status,
    statusByLanguage: {
      sinhala: row.sinhalaStatus as BlockStatus,
      tamil: row.tamilStatus as BlockStatus,
      english: row.englishStatus as BlockStatus,
    },
    content: { sinhala: row.sinhalaText, tamil: row.tamilText, english: row.englishText },
    editableLanguages,
    enabledLanguages,
  };
}

export type CreateBlockResult = { ok: true; blockId: string } | { ok: false; error: string };

export async function createBlockAction(
  _prev: CreateBlockResult | null,
  formData: FormData,
): Promise<CreateBlockResult> {
  const session = await sdk.auth.requireSession();
  const projectId = (formData.get('projectId') as string | null) ?? '';
  if (!projectId) return { ok: false, error: 'Missing project.' };

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role === 'viewer') return { ok: false, error: 'Viewers cannot add blocks.' };

  const groupId = (formData.get('groupId') as string | null) || null;
  const nextOrder = await nextOrderInBucket(db, projectId, groupId);

  const id = randomUUID();
  const now = nowSeconds();
  await db.insert(contentBlocks).values({
    id,
    tenantId: session.user.tenantId,
    projectId,
    groupId,
    blockType: 'text',
    orderNumber: nextOrder,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, blockId: id };
}

export type AutosaveResult = { ok: true; savedAt: number } | { ok: false; error: string };

function contentColumnPatch(
  language: Language,
  contentJson: string,
): Partial<typeof contentBlocks.$inferInsert> {
  switch (language) {
    case 'sinhala':
      return { sinhalaText: contentJson };
    case 'tamil':
      return { tamilText: contentJson };
    case 'english':
      return { englishText: contentJson };
  }
}

/**
 * Called directly from the client (not via `useActionState`) on a debounce
 * timer — one call per language pane per autosave tick.
 */
export async function autosaveBlockContentAction(
  projectId: string,
  blockId: string,
  language: Language,
  contentJson: string,
): Promise<AutosaveResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canEditLanguage(access, language)) {
    return { ok: false, error: 'You do not have permission to edit this language.' };
  }

  const now = nowSeconds();
  await db
    .update(contentBlocks)
    .set({ ...contentColumnPatch(language, contentJson), updatedAt: now })
    .where(and(eq(contentBlocks.id, blockId), eq(contentBlocks.projectId, projectId)));

  return { ok: true, savedAt: now };
}

function statusColumnPatch(
  language: Language,
  status: BlockStatus,
): Partial<typeof contentBlocks.$inferInsert> {
  switch (language) {
    case 'sinhala':
      return { sinhalaStatus: status };
    case 'tamil':
      return { tamilStatus: status };
    case 'english':
      return { englishStatus: status };
  }
}

export type UpdateBlockStatusResult = { ok: true } | { ok: false; error: string };

export async function updateBlockLanguageStatusAction(
  projectId: string,
  blockId: string,
  language: Language,
  status: BlockStatus,
): Promise<UpdateBlockStatusResult> {
  const session = await sdk.auth.requireSession();
  if (!BLOCK_STATUSES.includes(status)) return { ok: false, error: 'Invalid status.' };

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canEditLanguage(access, language)) {
    return { ok: false, error: 'You do not have permission to edit this language.' };
  }

  const [row] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.id, blockId), eq(contentBlocks.projectId, projectId)))
    .limit(1);
  if (!row) return { ok: false, error: 'Block not found.' };

  const enabledLanguages = JSON.parse(access.project.enabledLanguages) as Language[];
  const statusByLanguage: Record<Language, BlockStatus> = {
    sinhala: row.sinhalaStatus as BlockStatus,
    tamil: row.tamilStatus as BlockStatus,
    english: row.englishStatus as BlockStatus,
    [language]: status,
  };
  const nextStatus = aggregateStatus(enabledLanguages.map((lang) => statusByLanguage[lang]));

  await db
    .update(contentBlocks)
    .set({ ...statusColumnPatch(language, status), status: nextStatus, updatedAt: nowSeconds() })
    .where(and(eq(contentBlocks.id, blockId), eq(contentBlocks.projectId, projectId)));

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true };
}
