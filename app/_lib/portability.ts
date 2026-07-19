import { sdk } from '@sovereignfs/sdk';
import type {
  DeletionContext,
  DeletionResult,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import { contentBlockGroups, contentBlocks, projectMembers, projects } from './db/schema';

// The SDK intentionally returns an opaque dialect-agnostic DB client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = BaseSQLiteDatabase<'async', any, any>;

const PLUGIN_ID = 'com.mooniak.tritext';
const EXPORT_SCHEMA_VERSION = 1;

/**
 * Registers Tritext's export/import/delete participation (RFC 0007 /
 * RFC 0033, RFC 0068). Must be called from a request-scoped Tritext route —
 * this repo calls it from `app/layout.tsx`, same as every other
 * request-scoped setup (registrations are in-process and reset on restart).
 *
 * `custom_fonts` is deliberately excluded — it's a tenant-wide shared font
 * library (no `owner_user_id`, see the plugin's own CLAUDE.md "Data model"),
 * not one user's personal data.
 */
export async function registerPortabilityHandlers(): Promise<void> {
  await sdk.portability.provideExport(exportTritextData);
  await sdk.portability.provideImport(importTritextData);
  await sdk.portability.provideDelete(deleteAllTritextData);
}

// ---- Export shape ----

interface ExportProject {
  id: string;
  title: string;
  description: string | null;
  deadline: number | null;
  languageMode: string;
  enabledLanguages: string;
  primaryLanguage: string;
  createdAt: number;
  updatedAt: number;
}

interface ExportBlockGroup {
  id: string;
  projectId: string;
  name: string;
  orderNumber: number;
  isCollapsed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ExportBlock {
  id: string;
  projectId: string;
  groupId: string | null;
  blockType: string;
  sinhalaText: string | null;
  tamilText: string | null;
  englishText: string | null;
  status: string;
  sinhalaStatus: string;
  tamilStatus: string;
  englishStatus: string;
  characterLimit: number | null;
  wordLimit: number | null;
  orderNumber: number;
  notes: string | null;
  isLocked: boolean;
  sinhalaLocked: boolean;
  tamilLocked: boolean;
  englishLocked: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ExportProjectMember {
  projectId: string;
  role: string;
  canEditSinhala: boolean;
  canEditTamil: boolean;
  canEditEnglish: boolean;
  invitedAt: number;
}

interface TritextExportData {
  projects: ExportProject[];
  blockGroups: ExportBlockGroup[];
  blocks: ExportBlock[];
  /** The user's own collaborator grants on projects they own. Informational only — see the handler doc comment. */
  projectMembers: ExportProjectMember[];
}

async function exportTritextData(ctx: ExportContext): Promise<PluginExportSection> {
  const db = (await sdk.db.getClient()) as Db;
  const { userId, tenantId } = ctx;

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.tenantId, tenantId), eq(projects.ownerUserId, userId)));
  const projectIds = projectRows.map((p) => p.id);

  const data: TritextExportData = {
    projects: projectRows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      deadline: p.deadline,
      languageMode: p.languageMode,
      enabledLanguages: p.enabledLanguages,
      primaryLanguage: p.primaryLanguage,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    blockGroups: [],
    blocks: [],
    projectMembers: [],
  };

  if (projectIds.length > 0) {
    const [groupRows, blockRows, memberRows] = await Promise.all([
      db.select().from(contentBlockGroups).where(and(eq(contentBlockGroups.tenantId, tenantId), inArray(contentBlockGroups.projectId, projectIds))),
      db.select().from(contentBlocks).where(and(eq(contentBlocks.tenantId, tenantId), inArray(contentBlocks.projectId, projectIds))),
      db.select().from(projectMembers).where(and(eq(projectMembers.tenantId, tenantId), inArray(projectMembers.projectId, projectIds))),
    ]);
    data.blockGroups = groupRows.map((g) => ({
      id: g.id,
      projectId: g.projectId,
      name: g.name,
      orderNumber: g.orderNumber,
      isCollapsed: g.isCollapsed,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }));
    data.blocks = blockRows.map((b) => ({
      id: b.id,
      projectId: b.projectId,
      groupId: b.groupId,
      blockType: b.blockType,
      sinhalaText: b.sinhalaText,
      tamilText: b.tamilText,
      englishText: b.englishText,
      status: b.status,
      sinhalaStatus: b.sinhalaStatus,
      tamilStatus: b.tamilStatus,
      englishStatus: b.englishStatus,
      characterLimit: b.characterLimit,
      wordLimit: b.wordLimit,
      orderNumber: b.orderNumber,
      notes: b.notes,
      isLocked: b.isLocked,
      sinhalaLocked: b.sinhalaLocked,
      tamilLocked: b.tamilLocked,
      englishLocked: b.englishLocked,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
    data.projectMembers = memberRows.map((m) => ({
      projectId: m.projectId,
      role: m.role,
      canEditSinhala: m.canEditSinhala,
      canEditTamil: m.canEditTamil,
      canEditEnglish: m.canEditEnglish,
      invitedAt: m.invitedAt,
    }));
  }

  const warnings =
    data.projectMembers.length > 0
      ? [
          'Collaborator grants on your projects are carried as reference only, not re-created on import — re-invite collaborators after importing.',
        ]
      : undefined;

  return { pluginId: PLUGIN_ID, schemaVersion: EXPORT_SCHEMA_VERSION, data, warnings };
}

// ---- Import ----
// Additive only. `projectMembers` is not re-created — it names another
// user's account with no guaranteed counterpart on the importing instance,
// same treatment Docs gives `documentMembers`.

function isTritextExportData(value: unknown): value is TritextExportData {
  if (!value || typeof value !== 'object') return false;
  const c = value as Partial<TritextExportData>;
  return Array.isArray(c.projects) && Array.isArray(c.blockGroups) && Array.isArray(c.blocks);
}

async function importTritextData(section: PluginExportSection, ctx: ImportContext): Promise<void> {
  if (section.schemaVersion !== EXPORT_SCHEMA_VERSION || !isTritextExportData(section.data)) {
    throw new Error('Tritext import section has an unrecognized shape.');
  }
  const data = section.data;
  const db = (await sdk.db.getClient()) as Db;
  const ts = Math.floor(Date.now() / 1000);

  const originalProjectIds = new Set(data.projects.map((p) => p.id));
  const originalGroupIds = new Set(data.blockGroups.map((g) => g.id));

  for (const p of data.projects) {
    await db.insert(projects).values({
      id: ctx.remapId(p.id),
      tenantId: ctx.tenantId,
      title: p.title,
      description: p.description,
      deadline: p.deadline,
      languageMode: p.languageMode,
      enabledLanguages: p.enabledLanguages,
      primaryLanguage: p.primaryLanguage,
      ownerUserId: ctx.userId,
      createdAt: p.createdAt,
      updatedAt: ts,
    });
  }

  for (const g of data.blockGroups) {
    if (!originalProjectIds.has(g.projectId)) continue;
    await db.insert(contentBlockGroups).values({
      id: ctx.remapId(g.id),
      tenantId: ctx.tenantId,
      projectId: ctx.remapId(g.projectId),
      name: g.name,
      orderNumber: g.orderNumber,
      isCollapsed: g.isCollapsed,
      createdAt: g.createdAt,
      updatedAt: ts,
    });
  }

  for (const b of data.blocks) {
    if (!originalProjectIds.has(b.projectId)) continue;
    await db.insert(contentBlocks).values({
      id: ctx.remapId(b.id),
      tenantId: ctx.tenantId,
      projectId: ctx.remapId(b.projectId),
      groupId: b.groupId && originalGroupIds.has(b.groupId) ? ctx.remapId(b.groupId) : null,
      blockType: b.blockType,
      sinhalaText: b.sinhalaText,
      tamilText: b.tamilText,
      englishText: b.englishText,
      status: b.status,
      sinhalaStatus: b.sinhalaStatus,
      tamilStatus: b.tamilStatus,
      englishStatus: b.englishStatus,
      characterLimit: b.characterLimit,
      wordLimit: b.wordLimit,
      orderNumber: b.orderNumber,
      notes: b.notes,
      isLocked: b.isLocked,
      sinhalaLocked: b.sinhalaLocked,
      tamilLocked: b.tamilLocked,
      englishLocked: b.englishLocked,
      createdAt: b.createdAt,
      updatedAt: ts,
    });
  }
}

// ---- Delete ----

async function deleteAllTritextData(ctx: DeletionContext): Promise<DeletionResult> {
  const db = ctx.db as Db;
  let deleted = 0;

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.tenantId, ctx.tenantId), eq(projects.ownerUserId, ctx.userId)));
  const projectIds = projectRows.map((p) => p.id);

  if (projectIds.length > 0) {
    const [blockRows, memberRows] = await Promise.all([
      db
        .select({ id: contentBlocks.id })
        .from(contentBlocks)
        .where(and(eq(contentBlocks.tenantId, ctx.tenantId), inArray(contentBlocks.projectId, projectIds))),
      db
        .select({ id: projectMembers.id })
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.tenantId, ctx.tenantId),
            or(inArray(projectMembers.projectId, projectIds), eq(projectMembers.userId, ctx.userId)),
          ),
        ),
    ]);
    await db
      .delete(contentBlocks)
      .where(and(eq(contentBlocks.tenantId, ctx.tenantId), inArray(contentBlocks.projectId, projectIds)));
    await db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.tenantId, ctx.tenantId),
          or(inArray(projectMembers.projectId, projectIds), eq(projectMembers.userId, ctx.userId)),
        ),
      );
    deleted += blockRows.length + memberRows.length;

    const groupRows = await db
      .select({ id: contentBlockGroups.id })
      .from(contentBlockGroups)
      .where(and(eq(contentBlockGroups.tenantId, ctx.tenantId), inArray(contentBlockGroups.projectId, projectIds)));
    await db
      .delete(contentBlockGroups)
      .where(and(eq(contentBlockGroups.tenantId, ctx.tenantId), inArray(contentBlockGroups.projectId, projectIds)));
    deleted += groupRows.length;
  } else {
    const memberRows = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.tenantId, ctx.tenantId), eq(projectMembers.userId, ctx.userId)));
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.tenantId, ctx.tenantId), eq(projectMembers.userId, ctx.userId)));
    deleted += memberRows.length;
  }

  deleted += projectRows.length;
  await db
    .delete(projects)
    .where(and(eq(projects.tenantId, ctx.tenantId), eq(projects.ownerUserId, ctx.userId)));

  return { deleted };
}
