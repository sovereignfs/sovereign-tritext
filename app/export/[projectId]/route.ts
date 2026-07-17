import type { NextRequest } from 'next/server';
import { sdk } from '@sovereignfs/sdk';
import { getDb, type Language, resolveAccess } from '../../_lib/access';
import { generateProjectDocx, type ExportLayout } from '../../_lib/docx/generateDocx';
import { loadProjectExportContent } from '../../_lib/docx/exportData';

type Params = { params: Promise<{ projectId: string }> };

const LANGUAGES = new Set<Language>(['sinhala', 'tamil', 'english']);

function isLanguage(value: string | null): value is Language {
  return value !== null && LANGUAGES.has(value as Language);
}

function isLayout(value: string | null): value is ExportLayout {
  return value === 'per-language' || value === 'per-section';
}

/** ASCII-safe filename fragment — DOCX Content-Disposition doesn't need to survive arbitrary Unicode. */
function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return slug || 'project';
}

export async function GET(request: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const session = await sdk.auth.requireSession();

  const db = await getDb();
  const access = await resolveAccess(db, projectId, session.user.id, session.user.tenantId);
  if (!access) {
    return Response.json({ error: 'Project not found.' }, { status: 404 });
  }

  const layoutParam = request.nextUrl.searchParams.get('layout');
  const layout = isLayout(layoutParam) ? layoutParam : 'per-section';
  const languageParam = request.nextUrl.searchParams.get('language');

  if (layout === 'per-language' && !isLanguage(languageParam)) {
    return Response.json(
      { error: 'A valid language is required for the per-language layout.' },
      { status: 400 },
    );
  }

  const content = await loadProjectExportContent(db, access, projectId);
  const buffer = await generateProjectDocx({
    title: content.title,
    enabledLanguages: content.enabledLanguages,
    sections: content.sections,
    layout,
    language: layout === 'per-language' && isLanguage(languageParam) ? languageParam : undefined,
  });

  const suffix = layout === 'per-language' ? `-${languageParam}` : '-all-languages';
  const filename = `${slugify(content.title)}${suffix}.docx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
