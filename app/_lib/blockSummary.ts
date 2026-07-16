import { and, eq, isNull, type SQL } from 'drizzle-orm';
import type { Access, Db, Language } from './access';
import { contentBlocks } from './db/schema';
import { extractPlainText } from './editor/plainText';

/**
 * Plain (non-`'use server'`) helpers shared by `blocks-actions.ts` and
 * `groups-actions.ts`. Next.js requires every export of a `'use server'`
 * file to be an async function — these are synchronous, so they can't live
 * in either action file directly.
 */

export type BlockRow = typeof contentBlocks.$inferSelect;

export interface BlockSummary {
  id: string;
  groupId: string | null;
  blockType: string;
  status: string;
  orderNumber: number;
  updatedAt: number;
  preview: string;
}

/** Matches `content_blocks.group_id` — `null` means the ungrouped bucket. */
export function groupIdCondition(projectId: string, groupId: string | null): SQL | undefined {
  return and(
    eq(contentBlocks.projectId, projectId),
    groupId === null ? isNull(contentBlocks.groupId) : eq(contentBlocks.groupId, groupId),
  );
}

export function toBlockSummary(row: BlockRow, access: Access): BlockSummary {
  const primaryLanguage = access.project.primaryLanguage as Language;
  const byLanguage: Record<Language, string | null> = {
    sinhala: row.sinhalaText,
    tamil: row.tamilText,
    english: row.englishText,
  };
  const text = byLanguage[primaryLanguage] ?? row.sinhalaText ?? row.tamilText ?? row.englishText;
  return {
    id: row.id,
    groupId: row.groupId,
    blockType: row.blockType,
    status: row.status,
    orderNumber: row.orderNumber,
    updatedAt: row.updatedAt,
    preview: extractPlainText(text) || 'Empty block',
  };
}

/** Next `order_number` for a bucket (a specific group, or the ungrouped list). */
export async function nextOrderInBucket(
  db: Db,
  projectId: string,
  groupId: string | null,
): Promise<number> {
  const existing = await db
    .select({ orderNumber: contentBlocks.orderNumber })
    .from(contentBlocks)
    .where(groupIdCondition(projectId, groupId));
  return existing.reduce((max, row) => Math.max(max, row.orderNumber), -1) + 1;
}
