'use client';

import { Icon } from '@sovereignfs/ui';
import type { Language } from '../_lib/access';
import { lintBlock } from '../_lib/lint/engine';
import styles from '../tritext.module.css';

const LANGUAGE_LABEL: Record<Language, string> = {
  sinhala: 'Sinhala',
  tamil: 'Tamil',
  english: 'English',
};

/**
 * Live structure/semantic cross-language lint for one block — recomputed
 * from `content` on every render, not debounced or persisted, since it's
 * pure in-memory JS over content the editors already hold.
 */
export function LintPanel({
  enabledLanguages,
  content,
}: {
  enabledLanguages: Language[];
  content: Record<Language, string | null>;
}) {
  if (enabledLanguages.length < 2) return null;
  const issues = lintBlock({ enabledLanguages, content });

  if (issues.length === 0) {
    return (
      <div className={styles.lintPanelClean}>
        <Icon name="check" size="sm" aria-hidden />
        No cross-language issues found.
      </div>
    );
  }

  return (
    <div className={styles.lintPanel} role="status">
      <h2 className={styles.lintPanelTitle}>
        {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
      </h2>
      <ul className={styles.lintIssueList}>
        {issues.map((issue, index) => (
          <li
            key={`${issue.ruleId}-${issue.language ?? 'all'}-${index}`}
            className={[styles.lintIssue, issue.severity === 'error' && styles.lintIssueError]
              .filter(Boolean)
              .join(' ')}
          >
            <Icon name="alert-triangle" size="sm" aria-hidden />
            <span>
              {issue.language && (
                <strong className={styles.lintIssueLanguage}>
                  {LANGUAGE_LABEL[issue.language]}:{' '}
                </strong>
              )}
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
