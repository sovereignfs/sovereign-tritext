import { describe, expect, it } from 'vitest';
import type { Access } from '../access';
import { toBlockSummary } from '../blockSummary';
import type { BlockRow } from '../blockSummary';

function project(overrides: Partial<Access['project']> = {}): Access['project'] {
  return {
    id: 'p1',
    tenantId: 't1',
    ownerUserId: 'u1',
    title: 'Project',
    description: null,
    primaryLanguage: 'sinhala',
    enabledLanguages: JSON.stringify(['sinhala', 'tamil', 'english']),
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  } as Access['project'];
}

function block(overrides: Partial<BlockRow> = {}): BlockRow {
  return {
    id: 'b1',
    tenantId: 't1',
    projectId: 'p1',
    groupId: null,
    blockType: 'paragraph',
    status: 'draft',
    orderNumber: 0,
    sinhalaText: null,
    tamilText: null,
    englishText: null,
    createdAt: 0,
    updatedAt: 1000,
    ...overrides,
  } as BlockRow;
}

describe('toBlockSummary', () => {
  it('previews the primary language content when present', () => {
    const access: Access = { project: project(), role: 'owner', member: null };
    const summary = toBlockSummary(
      block({ sinhalaText: JSON.stringify({ root: { children: [{ children: [{ text: 'Hello' }] }] } }) }),
      access,
    );
    expect(summary.preview).toBe('Hello');
  });

  it('falls back through sinhala/tamil/english when the primary language is empty', () => {
    const access: Access = {
      project: project({ primaryLanguage: 'sinhala' }),
      role: 'owner',
      member: null,
    };
    const summary = toBlockSummary(
      block({ englishText: JSON.stringify({ root: { children: [{ children: [{ text: 'Fallback' }] }] } }) }),
      access,
    );
    expect(summary.preview).toBe('Fallback');
  });

  it('shows "Empty block" when no language has content', () => {
    const access: Access = { project: project(), role: 'owner', member: null };
    expect(toBlockSummary(block(), access).preview).toBe('Empty block');
  });

  it('carries through id, groupId, blockType, status, and orderNumber unchanged', () => {
    const access: Access = { project: project(), role: 'owner', member: null };
    const row = block({ id: 'b2', groupId: 'g1', blockType: 'heading', status: 'approved', orderNumber: 3 });
    const summary = toBlockSummary(row, access);
    expect(summary).toMatchObject({
      id: 'b2',
      groupId: 'g1',
      blockType: 'heading',
      status: 'approved',
      orderNumber: 3,
    });
  });

  it('counts lint issues for the block given the project’s enabled languages', () => {
    const access: Access = {
      project: project({ enabledLanguages: JSON.stringify(['sinhala', 'tamil']) }),
      role: 'owner',
      member: null,
    };
    const summary = toBlockSummary(
      block({ sinhalaText: JSON.stringify({ root: { children: [{ children: [{ text: 'Hi' }] }] } }) }),
      access,
    );
    expect(summary.issueCount).toBeGreaterThan(0);
  });
});
