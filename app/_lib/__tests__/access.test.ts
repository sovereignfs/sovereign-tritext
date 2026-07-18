import { describe, expect, it } from 'vitest';
import { canEditLanguage } from '../access';
import type { Access, ProjectRole } from '../access';

function access(role: ProjectRole, member: Partial<Access['member']> | null = null): Access {
  return {
    project: {} as Access['project'],
    role,
    member: member ? ({ ...member } as Access['member']) : null,
  };
}

describe('canEditLanguage', () => {
  it('always allows owners', () => {
    expect(canEditLanguage(access('owner'), 'sinhala')).toBe(true);
    expect(canEditLanguage(access('owner'), 'tamil')).toBe(true);
    expect(canEditLanguage(access('owner'), 'english')).toBe(true);
  });

  it('always allows admins', () => {
    expect(canEditLanguage(access('admin'), 'sinhala')).toBe(true);
  });

  it('denies viewers regardless of member flags', () => {
    expect(
      canEditLanguage(
        access('viewer', { canEditSinhala: true, canEditTamil: true, canEditEnglish: true }),
        'sinhala',
      ),
    ).toBe(false);
  });

  it('denies an editor with no member row', () => {
    expect(canEditLanguage(access('editor', null), 'sinhala')).toBe(false);
  });

  it('gates editors by their per-language can-edit flag', () => {
    const editorAccess = access('editor', {
      canEditSinhala: true,
      canEditTamil: false,
      canEditEnglish: true,
    });
    expect(canEditLanguage(editorAccess, 'sinhala')).toBe(true);
    expect(canEditLanguage(editorAccess, 'tamil')).toBe(false);
    expect(canEditLanguage(editorAccess, 'english')).toBe(true);
  });
});
