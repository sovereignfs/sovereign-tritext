import { eq } from 'drizzle-orm';
import type { Access, Db, Language } from '../access';
import { contentBlockGroups, contentBlocks } from '../db/schema';
import type { ExportBlock, ExportSection } from './generateDocx';

export interface ProjectExportContent {
  title: string;
  enabledLanguages: Language[];
  sections: ExportSection[];
}

/** Assembles a project's groups/blocks into export-ready sections, ordered and with empty groups dropped. */
export async function loadProjectExportContent(
  db: Db,
  access: Access,
  projectId: string,
): Promise<ProjectExportContent> {
  const [groupRows, blockRows] = await Promise.all([
    db.select().from(contentBlockGroups).where(eq(contentBlockGroups.projectId, projectId)),
    db.select().from(contentBlocks).where(eq(contentBlocks.projectId, projectId)),
  ]);

  const blocksByGroup = new Map<string | null, ExportBlock[]>();
  for (const row of [...blockRows].sort((a, b) => a.orderNumber - b.orderNumber)) {
    const list = blocksByGroup.get(row.groupId) ?? [];
    list.push({
      content: { sinhala: row.sinhalaText, tamil: row.tamilText, english: row.englishText },
    });
    blocksByGroup.set(row.groupId, list);
  }

  const sections: ExportSection[] = [...groupRows]
    .sort((a, b) => a.orderNumber - b.orderNumber)
    .map((group) => ({ name: group.name, blocks: blocksByGroup.get(group.id) ?? [] }))
    .filter((section) => section.blocks.length > 0);

  const ungrouped = blocksByGroup.get(null) ?? [];
  if (ungrouped.length > 0) sections.push({ name: 'Ungrouped', blocks: ungrouped });

  return {
    title: access.project.title,
    enabledLanguages: JSON.parse(access.project.enabledLanguages) as Language[],
    sections,
  };
}
