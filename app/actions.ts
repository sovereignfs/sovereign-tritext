'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, or } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sdk } from '@sovereignfs/sdk';
import { projectMembers, projects } from './_lib/db/schema';

type Db = BetterSQLite3Database<Record<string, never>>;

async function getDb(): Promise<Db> {
  return (await sdk.db.getClient()) as Db;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

const LANGUAGE_MODES = new Set(['monolingual', 'bilingual', 'trilingual']);
const LANGUAGES = new Set(['sinhala', 'tamil', 'english']);

export interface ProjectSummary {
  id: string;
  title: string;
  description: string | null;
  languageMode: string;
  updatedAt: number;
}

/** Projects the current user owns, plus any they're a `project_members` collaborator on. */
export async function listProjects(): Promise<ProjectSummary[]> {
  const session = await sdk.auth.requireSession();
  const { id: userId, tenantId } = session.user;
  const db = await getDb();

  const memberRows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.tenantId, tenantId)));
  const memberProjectIds = memberRows.map((row) => row.projectId);

  const rows = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.tenantId, tenantId),
        memberProjectIds.length > 0
          ? or(eq(projects.ownerUserId, userId), inArray(projects.id, memberProjectIds))
          : eq(projects.ownerUserId, userId),
      ),
    );

  return rows
    .map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      languageMode: project.languageMode,
      updatedAt: project.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectDetail {
  id: string;
  title: string;
  description: string | null;
  deadline: number | null;
  languageMode: string;
  enabledLanguages: string[];
  primaryLanguage: string;
  ownerUserId: string;
  createdAt: number;
  updatedAt: number;
  viewerRole: ProjectRole;
}

async function resolveAccess(
  db: Db,
  projectId: string,
  userId: string,
  tenantId: string,
): Promise<{ project: typeof projects.$inferSelect; role: ProjectRole } | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (!project) return null;
  if (project.ownerUserId === userId) return { project, role: 'owner' };

  const [member] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
        eq(projectMembers.tenantId, tenantId),
      ),
    )
    .limit(1);
  if (!member) return null;
  return { project, role: member.role as ProjectRole };
}

/** Returns `null` if the project doesn't exist or the current user has no access to it. */
export async function getProject(projectId: string): Promise<ProjectDetail | null> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return null;

  const { project, role } = access;
  return {
    id: project.id,
    title: project.title,
    description: project.description,
    deadline: project.deadline,
    languageMode: project.languageMode,
    enabledLanguages: JSON.parse(project.enabledLanguages) as string[],
    primaryLanguage: project.primaryLanguage,
    ownerUserId: project.ownerUserId,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    viewerRole: role,
  };
}

export type CreateProjectResult = { ok: true; projectId: string } | { ok: false; error: string };

export async function createProjectAction(
  _prev: CreateProjectResult | null,
  formData: FormData,
): Promise<CreateProjectResult> {
  const session = await sdk.auth.requireSession();
  const title = (formData.get('title') as string | null)?.trim() ?? '';
  if (title.length === 0) return { ok: false, error: 'Title is required.' };
  if (title.length > 200) return { ok: false, error: 'Title must be 200 characters or fewer.' };
  const description = (formData.get('description') as string | null)?.trim() || null;

  const db = await getDb();
  const now = nowSeconds();
  const id = randomUUID();
  await db.insert(projects).values({
    id,
    tenantId: session.user.tenantId,
    title,
    description,
    languageMode: 'trilingual',
    enabledLanguages: JSON.stringify(['sinhala', 'tamil', 'english']),
    primaryLanguage: 'sinhala',
    ownerUserId: session.user.id,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath('/tritext');
  return { ok: true, projectId: id };
}

export type UpdateProjectSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function updateProjectSettingsAction(
  _prev: UpdateProjectSettingsResult | null,
  formData: FormData,
): Promise<UpdateProjectSettingsResult> {
  const session = await sdk.auth.requireSession();
  const projectId = (formData.get('projectId') as string | null) ?? '';
  if (!projectId) return { ok: false, error: 'Missing project.' };

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (access.role !== 'owner' && access.role !== 'admin') {
    return { ok: false, error: 'Only the project owner or an admin can change settings.' };
  }

  const title = (formData.get('title') as string | null)?.trim() ?? '';
  if (title.length === 0) return { ok: false, error: 'Title is required.' };
  if (title.length > 200) return { ok: false, error: 'Title must be 200 characters or fewer.' };
  const description = (formData.get('description') as string | null)?.trim() || null;

  const deadlineRaw = (formData.get('deadline') as string | null) ?? '';
  let deadline: number | null = null;
  if (deadlineRaw) {
    const parsed = new Date(deadlineRaw).getTime();
    if (Number.isNaN(parsed)) return { ok: false, error: 'Invalid deadline date.' };
    deadline = Math.floor(parsed / 1000);
  }

  const languageMode = (formData.get('languageMode') as string | null) ?? '';
  if (!LANGUAGE_MODES.has(languageMode)) return { ok: false, error: 'Invalid language mode.' };

  const enabledLanguages = formData
    .getAll('enabledLanguages')
    .filter((value): value is string => typeof value === 'string' && LANGUAGES.has(value));
  if (enabledLanguages.length === 0) {
    return { ok: false, error: 'At least one language must be enabled.' };
  }

  const primaryLanguage = (formData.get('primaryLanguage') as string | null) ?? '';
  if (!LANGUAGES.has(primaryLanguage) || !enabledLanguages.includes(primaryLanguage)) {
    return { ok: false, error: 'Primary language must be one of the enabled languages.' };
  }

  await db
    .update(projects)
    .set({
      title,
      description,
      deadline,
      languageMode,
      enabledLanguages: JSON.stringify(enabledLanguages),
      primaryLanguage,
      updatedAt: nowSeconds(),
    })
    .where(eq(projects.id, projectId));

  revalidatePath(`/tritext/${projectId}`);
  revalidatePath('/tritext');
  return { ok: true, message: 'Project settings saved.' };
}
