'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { sdk } from '@sovereignfs/sdk';
import { canEditLanguage, getDb, type Language, nowSeconds, resolveAccess } from './_lib/access';
import { contentBlocks } from './_lib/db/schema';
import { extractPlainText } from './_lib/editor/plainText';

export interface BlockSummary {
  id: string;
  blockType: string;
  status: string;
  orderNumber: number;
  updatedAt: number;
  preview: string;
}

/** Ungrouped blocks for a project — block groups land in a later phase. */
export async function listBlocks(projectId: string): Promise<BlockSummary[]> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return [];

  const rows = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.projectId, projectId), isNull(contentBlocks.groupId)));

  const primaryLanguage = access.project.primaryLanguage as Language;

  return rows
    .map((row) => {
      const byLanguage: Record<Language, string | null> = {
        sinhala: row.sinhalaText,
        tamil: row.tamilText,
        english: row.englishText,
      };
      const text =
        byLanguage[primaryLanguage] ?? row.sinhalaText ?? row.tamilText ?? row.englishText;
      return {
        id: row.id,
        blockType: row.blockType,
        status: row.status,
        orderNumber: row.orderNumber,
        updatedAt: row.updatedAt,
        preview: extractPlainText(text) || 'Empty block',
      };
    })
    .sort((a, b) => a.orderNumber - b.orderNumber);
}

export interface BlockDetail {
  id: string;
  projectId: string;
  blockType: string;
  status: string;
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

  const existing = await db
    .select({ orderNumber: contentBlocks.orderNumber })
    .from(contentBlocks)
    .where(and(eq(contentBlocks.projectId, projectId), isNull(contentBlocks.groupId)));
  const nextOrder = existing.reduce((max, row) => Math.max(max, row.orderNumber), -1) + 1;

  const id = randomUUID();
  const now = nowSeconds();
  await db.insert(contentBlocks).values({
    id,
    tenantId: session.user.tenantId,
    projectId,
    groupId: null,
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
