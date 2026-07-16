import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sdk } from '@sovereignfs/sdk';
import { projectMembers, projects } from './db/schema';

export type Db = BetterSQLite3Database<Record<string, never>>;

export async function getDb(): Promise<Db> {
  return (await sdk.db.getClient()) as Db;
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type Language = 'sinhala' | 'tamil' | 'english';

/** Resolves the current user's access to a project, or `null` if they have none. */
export async function resolveAccess(
  db: Db,
  projectId: string,
  userId: string,
  tenantId: string,
): Promise<{
  project: typeof projects.$inferSelect;
  role: ProjectRole;
  member: typeof projectMembers.$inferSelect | null;
} | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.tenantId, tenantId)))
    .limit(1);
  if (!project) return null;
  if (project.ownerUserId === userId) return { project, role: 'owner', member: null };

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
  return { project, role: member.role as ProjectRole, member };
}

const CAN_EDIT_FLAG: Record<Language, keyof typeof projectMembers.$inferSelect> = {
  sinhala: 'canEditSinhala',
  tamil: 'canEditTamil',
  english: 'canEditEnglish',
};

/** Whether the resolved access allows editing the given language's content. */
export function canEditLanguage(
  access: { role: ProjectRole; member: typeof projectMembers.$inferSelect | null },
  language: Language,
): boolean {
  if (access.role === 'owner' || access.role === 'admin') return true;
  if (access.role !== 'editor' || !access.member) return false;
  return access.member[CAN_EDIT_FLAG[language]] === true;
}
