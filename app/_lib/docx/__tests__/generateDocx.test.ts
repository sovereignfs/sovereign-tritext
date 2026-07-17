import { Document, Packer, Paragraph } from 'docx';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Language } from '../../access';
import { generateProjectDocx, type ExportSection } from '../generateDocx';
import { lexicalJsonToParagraphs } from '../lexicalToDocx';

function doc(...nodes: unknown[]): string {
  return JSON.stringify({ root: { children: nodes } });
}

function paragraph(text: string, format?: number) {
  return { type: 'paragraph', children: [{ type: 'text', text, format }] };
}

function heading(tag: string, text: string) {
  return { type: 'heading', tag, children: [{ type: 'text', text }] };
}

function quote(text: string) {
  return { type: 'quote', children: [{ type: 'text', text }] };
}

function list(...items: string[]) {
  return {
    type: 'list',
    children: items.map((text) => ({
      type: 'listitem',
      children: [{ type: 'text', text }],
    })),
  };
}

/**
 * Packs paragraphs into a real .docx (a ZIP archive) and extracts
 * `word/document.xml` — `Packer.toString` returns the raw packed ZIP bytes,
 * not readable XML, so unzipping is the only way to assert on content.
 */
async function renderXml(paragraphs: Paragraph[]): Promise<string> {
  const document = new Document({ sections: [{ children: paragraphs }] });
  const buffer = await Packer.toBuffer(document);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = zip.file('word/document.xml');
  if (!documentXml) throw new Error('word/document.xml missing from generated .docx');
  return documentXml.async('string');
}

describe('lexicalJsonToParagraphs', () => {
  it('returns nothing for null or empty content', () => {
    expect(lexicalJsonToParagraphs(null)).toEqual([]);
    expect(lexicalJsonToParagraphs(doc())).toEqual([]);
  });

  it('falls back to a single paragraph for pre-editor plain text', async () => {
    const paragraphs = lexicalJsonToParagraphs('Just plain text.');
    expect(paragraphs).toHaveLength(1);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('Just plain text.');
  });

  it('renders a plain paragraph', async () => {
    const paragraphs = lexicalJsonToParagraphs(doc(paragraph('Hello world.')));
    expect(paragraphs).toHaveLength(1);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('Hello world.');
  });

  it('renders headings at the correct level', async () => {
    const paragraphs = lexicalJsonToParagraphs(doc(heading('h1', 'Title'), heading('h2', 'Subtitle')));
    expect(paragraphs).toHaveLength(2);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('Heading2');
    expect(xml).toContain('Heading3');
  });

  it('renders bold, italic, and underline runs', async () => {
    const BOLD = 1;
    const ITALIC = 2;
    const UNDERLINE = 8;
    const paragraphs = lexicalJsonToParagraphs(
      doc({
        type: 'paragraph',
        children: [
          { type: 'text', text: 'bold', format: BOLD },
          { type: 'text', text: 'italic', format: ITALIC },
          { type: 'text', text: 'underline', format: UNDERLINE },
        ],
      }),
    );
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('<w:u ');
  });

  it('indents quotes', async () => {
    const paragraphs = lexicalJsonToParagraphs(doc(quote('A wise quote.')));
    expect(paragraphs).toHaveLength(1);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('A wise quote.');
    expect(xml).toContain('<w:ind ');
  });

  it('renders bulleted list items', async () => {
    const paragraphs = lexicalJsonToParagraphs(doc(list('First', 'Second')));
    expect(paragraphs).toHaveLength(2);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('First');
    expect(xml).toContain('Second');
    expect(xml).toContain('<w:numPr>');
  });

  it('renders nested list items one level deeper', async () => {
    const nested = {
      type: 'list',
      children: [
        {
          type: 'listitem',
          children: [
            { type: 'text', text: 'Parent' },
            { type: 'list', children: [{ type: 'listitem', children: [{ type: 'text', text: 'Child' }] }] },
          ],
        },
      ],
    };
    const paragraphs = lexicalJsonToParagraphs(doc(nested));
    expect(paragraphs).toHaveLength(2);
    const xml = await renderXml(paragraphs);
    expect(xml).toContain('Parent');
    expect(xml).toContain('Child');
  });
});

const LANGUAGES: Language[] = ['sinhala', 'tamil', 'english'];

function section(name: string, sinhala: string, tamil: string, english: string): ExportSection {
  return {
    name,
    blocks: [
      {
        content: {
          sinhala: doc(paragraph(sinhala)),
          tamil: doc(paragraph(tamil)),
          english: doc(paragraph(english)),
        },
      },
    ],
  };
}

describe('generateProjectDocx', () => {
  it('produces a valid .docx (zip) buffer for the per-language layout', async () => {
    const buffer = await generateProjectDocx({
      title: 'My Project',
      enabledLanguages: LANGUAGES,
      sections: [section('Intro', 'Sinhala text', 'Tamil text', 'English text')],
      layout: 'per-language',
      language: 'english',
    });
    // .docx files are ZIP archives — "PK\x03\x04" is the local file header magic number.
    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('produces a valid .docx buffer for the per-section layout', async () => {
    const buffer = await generateProjectDocx({
      title: 'My Project',
      enabledLanguages: LANGUAGES,
      sections: [section('Intro', 'Sinhala text', 'Tamil text', 'English text')],
      layout: 'per-section',
    });
    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('throws when per-language layout is requested without a language', async () => {
    await expect(
      generateProjectDocx({
        title: 'My Project',
        enabledLanguages: LANGUAGES,
        sections: [section('Intro', 'S', 'T', 'E')],
        layout: 'per-language',
      }),
    ).rejects.toThrow();
  });

  it('handles a project with no sections', async () => {
    const buffer = await generateProjectDocx({
      title: 'Empty Project',
      enabledLanguages: LANGUAGES,
      sections: [],
      layout: 'per-section',
    });
    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});
