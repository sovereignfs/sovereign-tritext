'use client';

import { useState } from 'react';
import { Button, Select } from '@sovereignfs/ui';
import type { Language } from '../_lib/access';
import styles from '../tritext.module.css';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

type ExportLayout = 'per-language' | 'per-section';

export function ExportSection({
  projectId,
  enabledLanguages,
}: {
  projectId: string;
  enabledLanguages: Language[];
}) {
  const [layout, setLayout] = useState<ExportLayout>('per-section');
  const [language, setLanguage] = useState<Language>(enabledLanguages[0] ?? 'sinhala');

  function handleDownload() {
    const params = new URLSearchParams({ layout });
    if (layout === 'per-language') params.set('language', language);
    // A plain top-level navigation, not fetch+blob — the response's
    // Content-Disposition: attachment header makes the browser download it
    // without leaving the current page.
    window.location.href = `/tritext/export/${projectId}?${params.toString()}`;
  }

  return (
    <section className={styles.blocksSection}>
      <div className={styles.blocksSectionHeader}>
        <h2 className={styles.sectionTitle}>Export</h2>
      </div>
      <div className={styles.exportControls}>
        <Select
          size="sm"
          aria-label="Export layout"
          value={layout}
          onChange={(event) => setLayout(event.target.value as ExportLayout)}
        >
          <option value="per-section">Per section (all languages)</option>
          <option value="per-language">Per language</option>
        </Select>
        {layout === 'per-language' && (
          <Select
            size="sm"
            aria-label="Export language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
          >
            {enabledLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang]}
              </option>
            ))}
          </Select>
        )}
        <Button type="button" size="sm" onClick={handleDownload}>
          Download .docx
        </Button>
      </div>
    </section>
  );
}
