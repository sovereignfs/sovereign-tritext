import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { Language } from '../access';
import { lexicalJsonToParagraphs } from './lexicalToDocx';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

export interface ExportBlock {
  content: Record<Language, string | null>;
}

export interface ExportSection {
  /** Group name, or "Ungrouped" for blocks with no group. */
  name: string;
  blocks: ExportBlock[];
}

export type ExportLayout = 'per-language' | 'per-section';

export interface ExportInput {
  title: string;
  enabledLanguages: Language[];
  sections: ExportSection[];
  layout: ExportLayout;
  /** Required when `layout === 'per-language'` — which language to export. */
  language?: Language;
}

/**
 * Builds a project export as a `docx` `Document` and packs it to a Buffer.
 * `per-language`: one language's content only, across every section, for a
 * publishable single-language document. `per-section`: every enabled
 * language shown together under each block, for side-by-side review.
 */
export async function generateProjectDocx(input: ExportInput): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(input.title)] }),
  ];

  for (const section of input.sections) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(section.name)] }));

    for (const block of section.blocks) {
      if (input.layout === 'per-language') {
        const language = input.language;
        if (!language) throw new Error('language is required for the per-language layout.');
        children.push(...lexicalJsonToParagraphs(block.content[language]));
      } else {
        for (const language of input.enabledLanguages) {
          children.push(
            new Paragraph({ children: [new TextRun({ text: LANGUAGE_LABEL[language], bold: true })] }),
          );
          const paragraphs = lexicalJsonToParagraphs(block.content[language]);
          children.push(
            ...(paragraphs.length > 0
              ? paragraphs
              : [new Paragraph({ children: [new TextRun({ text: '(empty)', italics: true })] })]),
          );
        }
      }
    }
  }

  const document = new Document({ sections: [{ children }] });
  return Packer.toBuffer(document);
}
