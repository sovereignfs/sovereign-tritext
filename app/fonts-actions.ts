'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { sdk } from '@sovereignfs/sdk';
import { getDb, type Language, nowSeconds, resolveAccess } from './_lib/access';
import { customFonts } from './_lib/db/schema';
import { guessFontFormat } from './_lib/fontFace';

const ALL_SCRIPTS = new Set<Language>(['sinhala', 'tamil', 'english']);
const ALLOWED_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);
const MAX_FONT_BYTES = 5 * 1024 * 1024; // 5 MB — a webfont file is typically well under this.
/** CSS `font-family` identifier — plain text only, since it flows unescaped into a `<style>` tag (see fontFace.ts). */
const FAMILY_NAME_PATTERN = /^[a-zA-Z0-9 _-]+$/;

function canManageFonts(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

function fileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
}

export interface FontSummary {
  id: string;
  familyName: string;
  displayName: string;
  supportedScripts: Language[];
  isActive: boolean;
}

export interface FontsForManagement {
  fonts: FontSummary[];
  canManage: boolean;
}

/** Fonts are tenant-wide, not per-project — `projectId` only decides `canManage` (same project-admin check as Members). */
export async function listFontsForManagement(projectId: string): Promise<FontsForManagement | null> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return null;

  const rows = await db
    .select()
    .from(customFonts)
    .where(eq(customFonts.tenantId, session.user.tenantId));

  return {
    fonts: rows
      .sort((a, b) => a.orderNumber - b.orderNumber)
      .map((row) => ({
        id: row.id,
        familyName: row.familyName,
        displayName: row.displayName,
        supportedScripts: JSON.parse(row.supportedScripts) as Language[],
        isActive: row.isActive,
      })),
    canManage: canManageFonts(access.role),
  };
}

export interface FontFaceSource {
  familyName: string;
  url: string;
  format: string;
}

/** Active fonts with a fresh signed URL each — used for `@font-face` injection (`app/layout.tsx`). No project gating: any tenant member reads the shared font library. */
export async function listActiveFontsForFontFace(): Promise<FontFaceSource[]> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const rows = await db
    .select()
    .from(customFonts)
    .where(and(eq(customFonts.tenantId, session.user.tenantId), eq(customFonts.isActive, true)));

  const sources: FontFaceSource[] = [];
  for (const row of rows) {
    try {
      const url = await sdk.storage.getSignedUrl(row.storageKey, { expiresInSeconds: 3600 });
      sources.push({ familyName: row.familyName, url, format: guessFontFormat(row.storageKey) });
    } catch {
      // A signed-URL failure for one font must not break every other font
      // (or the whole page) — skip it, it just falls back to a system font.
    }
  }
  return sources;
}

export type FontActionResult = { ok: true; message: string } | { ok: false; error: string };

export async function uploadFontAction(
  projectId: string,
  _prev: FontActionResult | null,
  formData: FormData,
): Promise<FontActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageFonts(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can add fonts.' };
  }

  const file = formData.get('file');
  const familyName = (formData.get('familyName') as string | null)?.trim() ?? '';
  const displayName = (formData.get('displayName') as string | null)?.trim() ?? '';
  const scripts = formData
    .getAll('supportedScripts')
    .filter((value): value is string => typeof value === 'string' && ALL_SCRIPTS.has(value as Language));

  if (!(file instanceof Blob) || file.size === 0) return { ok: false, error: 'Choose a font file.' };
  if (file.size > MAX_FONT_BYTES) return { ok: false, error: 'Font files must be 5 MB or smaller.' };
  const filename = file instanceof File ? file.name : 'font';
  const extension = fileExtension(filename);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return { ok: false, error: 'Only .woff2, .woff, .ttf, or .otf files are supported.' };
  }
  if (!familyName || !FAMILY_NAME_PATTERN.test(familyName)) {
    return { ok: false, error: 'Family name must use only letters, numbers, spaces, - or _.' };
  }
  if (!displayName) return { ok: false, error: 'Display name is required.' };
  if (scripts.length === 0) return { ok: false, error: 'Choose at least one script.' };

  const id = randomUUID();
  const storageKey = `fonts/${id}/${filename}`;
  await sdk.storage.put({
    key: storageKey,
    body: file,
    contentType: 'font/' + (extension === 'ttf' ? 'ttf' : extension === 'otf' ? 'otf' : extension),
    metadata: { originalFilename: filename },
  });

  const existing = await db
    .select({ orderNumber: customFonts.orderNumber })
    .from(customFonts)
    .where(eq(customFonts.tenantId, session.user.tenantId));
  const nextOrder = existing.reduce((max, row) => Math.max(max, row.orderNumber), -1) + 1;

  await db.insert(customFonts).values({
    id,
    tenantId: session.user.tenantId,
    familyName,
    displayName,
    storageKey,
    supportedScripts: JSON.stringify(scripts),
    isActive: true,
    orderNumber: nextOrder,
    createdAt: nowSeconds(),
    createdBy: session.user.id,
  });

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: `Added "${displayName}".` };
}

export async function toggleFontActiveAction(
  projectId: string,
  fontId: string,
  isActive: boolean,
): Promise<FontActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageFonts(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can change fonts.' };
  }

  await db
    .update(customFonts)
    .set({ isActive })
    .where(and(eq(customFonts.id, fontId), eq(customFonts.tenantId, session.user.tenantId)));

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: isActive ? 'Font enabled.' : 'Font disabled.' };
}

export async function deleteFontAction(
  projectId: string,
  fontId: string,
): Promise<FontActionResult> {
  const session = await sdk.auth.requireSession();
  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) return { ok: false, error: 'Project not found.' };
  if (!canManageFonts(access.role)) {
    return { ok: false, error: 'Only the project owner or an admin can remove fonts.' };
  }

  const [font] = await db
    .select({ storageKey: customFonts.storageKey })
    .from(customFonts)
    .where(and(eq(customFonts.id, fontId), eq(customFonts.tenantId, session.user.tenantId)))
    .limit(1);
  if (!font) return { ok: false, error: 'Font not found.' };

  await sdk.storage.delete(font.storageKey);
  await db
    .delete(customFonts)
    .where(and(eq(customFonts.id, fontId), eq(customFonts.tenantId, session.user.tenantId)));

  revalidatePath(`/tritext/${projectId}`);
  return { ok: true, message: 'Font removed.' };
}
