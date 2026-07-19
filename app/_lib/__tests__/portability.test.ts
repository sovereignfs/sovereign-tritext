import { getTableName, type Table } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DeletionContext,
  ExportContext,
  ImportContext,
  PluginExportSection,
} from '@sovereignfs/sdk';

type Row = Record<string, unknown>;
type Condition =
  | { kind: 'eq'; key: string; value: unknown }
  | { kind: 'and'; conditions: Condition[] }
  | { kind: 'or'; conditions: Condition[] };

function toCamel(snake: string): string {
  return snake.replace(/_([a-z0-9])/g, (_match, c: string) => c.toUpperCase());
}

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (column: { name: string }, value: unknown): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value,
    }),
    and: (...conditions: Condition[]): Condition => ({ kind: 'and', conditions }),
    or: (...conditions: Condition[]): Condition => ({ kind: 'or', conditions }),
    inArray: (column: { name: string }, values: unknown[]): Condition => ({
      kind: 'eq',
      key: toCamel(column.name),
      value: values,
    }),
  };
});

function matches(row: Row, condition?: Condition): boolean {
  if (!condition) return true;
  if (condition.kind === 'eq') {
    if (Array.isArray(condition.value)) return condition.value.includes(row[condition.key]);
    return row[condition.key] === condition.value;
  }
  if (condition.kind === 'and') return condition.conditions.every((c) => matches(row, c));
  return condition.conditions.some((c) => matches(row, c));
}

const capturedExporter = { fn: null as ((ctx: ExportContext) => Promise<PluginExportSection>) | null };
const capturedImporter = {
  fn: null as ((section: PluginExportSection, ctx: ImportContext) => Promise<void>) | null,
};
const capturedDeleter = {
  fn: null as ((ctx: DeletionContext) => Promise<{ deleted: number; errors?: string[] }>) | null,
};

vi.mock('@sovereignfs/sdk', () => ({
  sdk: {
    db: { getClient: vi.fn(async () => fakeDb) },
    portability: {
      provideExport: vi.fn(async (fn: typeof capturedExporter.fn) => {
        capturedExporter.fn = fn;
      }),
      provideImport: vi.fn(async (fn: typeof capturedImporter.fn) => {
        capturedImporter.fn = fn;
      }),
      provideDelete: vi.fn(async (fn: typeof capturedDeleter.fn) => {
        capturedDeleter.fn = fn;
      }),
    },
  },
}));

interface Store extends Record<string, Row[]> {
  projects: Row[];
  content_block_groups: Row[];
  content_blocks: Row[];
  project_members: Row[];
}

let store: Store = { projects: [], content_block_groups: [], content_blocks: [], project_members: [] };

function resetStore() {
  store = { projects: [], content_block_groups: [], content_blocks: [], project_members: [] };
}

const fakeDb = {
  select(columns?: Record<string, unknown>) {
    return {
      from(table: Table) {
        const tableName = getTableName(table);
        return {
          where: async (condition?: Condition) => {
            const rows = (store[tableName] ?? []).filter((row) => matches(row, condition));
            if (!columns) return rows;
            return rows.map((row) => {
              const projected: Row = {};
              for (const key of Object.keys(columns)) projected[key] = row[key];
              return projected;
            });
          },
        };
      },
    };
  },
  insert(table: Table) {
    const tableName = getTableName(table);
    return {
      values: async (row: Row) => {
        (store[tableName] ??= []).push(row);
      },
    };
  },
  delete(table: Table) {
    const tableName = getTableName(table);
    return {
      where: async (condition?: Condition) => {
        store[tableName] = (store[tableName] ?? []).filter((row) => !matches(row, condition));
      },
    };
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetStore();
});

describe('portability export', () => {
  it("exports only the user's own projects, groups, and blocks — never another user's", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.projects = [
      { id: 'proj-1', tenantId: 't1', title: 'Handbook', description: null, deadline: null, languageMode: 'trilingual', enabledLanguages: '["sinhala","tamil","english"]', primaryLanguage: 'sinhala', ownerUserId: 'u1', createdAt: 1, updatedAt: 1 },
      { id: 'proj-2', tenantId: 't1', title: 'Not mine', description: null, deadline: null, languageMode: 'trilingual', enabledLanguages: '[]', primaryLanguage: 'sinhala', ownerUserId: 'other', createdAt: 1, updatedAt: 1 },
    ];
    store.content_block_groups = [
      { id: 'group-1', tenantId: 't1', projectId: 'proj-1', name: 'Intro', orderNumber: 0, isCollapsed: false, createdAt: 1, updatedAt: 1 },
    ];
    store.content_blocks = [
      { id: 'block-1', tenantId: 't1', projectId: 'proj-1', groupId: 'group-1', blockType: 'text', sinhalaText: 'a', tamilText: null, englishText: null, status: 'draft', sinhalaStatus: 'draft', tamilStatus: 'draft', englishStatus: 'draft', characterLimit: null, wordLimit: null, orderNumber: 0, notes: null, isLocked: false, sinhalaLocked: false, tamilLocked: false, englishLocked: false, createdAt: 1, updatedAt: 1 },
    ];
    store.project_members = [
      { id: 'mem-1', tenantId: 't1', projectId: 'proj-1', userId: 'other', role: 'editor', canEditSinhala: true, canEditTamil: false, canEditEnglish: false, invitedAt: 1, invitedBy: 'u1' },
    ];

    const section = await capturedExporter.fn?.({
      userId: 'u1',
      tenantId: 't1',
      options: { includeFiles: true },
    });
    expect(section).toBeDefined();

    const data = (section as PluginExportSection).data as {
      projects: { id: string }[];
      blockGroups: { id: string }[];
      blocks: { id: string }[];
    };
    expect(data.projects.map((p) => p.id)).toEqual(['proj-1']);
    expect(data.blockGroups.map((g) => g.id)).toEqual(['group-1']);
    expect(data.blocks.map((b) => b.id)).toEqual(['block-1']);
    expect((section as PluginExportSection).warnings?.length).toBeGreaterThan(0);
  });
});

describe('portability import', () => {
  it('remaps a block to its project and group and scopes ownership to the importing user', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'com.mooniak.tritext',
      schemaVersion: 1,
      data: {
        projects: [{ id: 'src-proj-1', title: 'Handbook', description: null, deadline: null, languageMode: 'trilingual', enabledLanguages: '[]', primaryLanguage: 'sinhala', createdAt: 1, updatedAt: 1 }],
        blockGroups: [{ id: 'src-group-1', projectId: 'src-proj-1', name: 'Intro', orderNumber: 0, isCollapsed: false, createdAt: 1, updatedAt: 1 }],
        blocks: [
          { id: 'src-block-1', projectId: 'src-proj-1', groupId: 'src-group-1', blockType: 'text', sinhalaText: 'a', tamilText: null, englishText: null, status: 'draft', sinhalaStatus: 'draft', tamilStatus: 'draft', englishStatus: 'draft', characterLimit: null, wordLimit: null, orderNumber: 0, notes: null, isLocked: false, sinhalaLocked: false, tamilLocked: false, englishLocked: false, createdAt: 1, updatedAt: 1 },
        ],
        projectMembers: [],
      },
    };

    await capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId: (id) => `new-${id}` });

    expect(store.projects).toEqual([expect.objectContaining({ id: 'new-src-proj-1', ownerUserId: 'u2' })]);
    expect(store.content_block_groups).toEqual([
      expect.objectContaining({ id: 'new-src-group-1', projectId: 'new-src-proj-1' }),
    ]);
    expect(store.content_blocks).toEqual([
      expect.objectContaining({ id: 'new-src-block-1', projectId: 'new-src-proj-1', groupId: 'new-src-group-1' }),
    ]);
  });

  it('skips a block group whose projectId is not part of this export', async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    const section: PluginExportSection = {
      pluginId: 'com.mooniak.tritext',
      schemaVersion: 1,
      data: {
        projects: [],
        blockGroups: [{ id: 'orphan-group', projectId: 'missing-project', name: 'X', orderNumber: 0, isCollapsed: false, createdAt: 1, updatedAt: 1 }],
        blocks: [],
        projectMembers: [],
      },
    };

    await capturedImporter.fn?.(section, { userId: 'u2', tenantId: 't1', remapId: (id) => `new-${id}` });
    expect(store.content_block_groups).toEqual([]);
  });
});

describe('portability delete', () => {
  it("deletes only the user's own projects, groups, blocks, and memberships", async () => {
    const { registerPortabilityHandlers } = await import('../portability');
    await registerPortabilityHandlers();

    store.projects = [
      { id: 'proj-1', tenantId: 't1', title: 'Mine', description: null, deadline: null, languageMode: 'trilingual', enabledLanguages: '[]', primaryLanguage: 'sinhala', ownerUserId: 'u1', createdAt: 1, updatedAt: 1 },
      { id: 'proj-2', tenantId: 't1', title: 'Not mine', description: null, deadline: null, languageMode: 'trilingual', enabledLanguages: '[]', primaryLanguage: 'sinhala', ownerUserId: 'other', createdAt: 1, updatedAt: 1 },
    ];
    store.content_block_groups = [
      { id: 'group-1', tenantId: 't1', projectId: 'proj-1', name: 'Intro', orderNumber: 0, isCollapsed: false, createdAt: 1, updatedAt: 1 },
    ];
    store.content_blocks = [
      { id: 'block-1', tenantId: 't1', projectId: 'proj-1', groupId: 'group-1', blockType: 'text', sinhalaText: 'a', tamilText: null, englishText: null, status: 'draft', sinhalaStatus: 'draft', tamilStatus: 'draft', englishStatus: 'draft', characterLimit: null, wordLimit: null, orderNumber: 0, notes: null, isLocked: false, sinhalaLocked: false, tamilLocked: false, englishLocked: false, createdAt: 1, updatedAt: 1 },
    ];
    store.project_members = [
      { id: 'mem-1', tenantId: 't1', projectId: 'proj-1', userId: 'other', role: 'editor', canEditSinhala: true, canEditTamil: false, canEditEnglish: false, invitedAt: 1, invitedBy: 'u1' },
      { id: 'mem-2', tenantId: 't1', projectId: 'proj-2', userId: 'u1', role: 'viewer', canEditSinhala: false, canEditTamil: false, canEditEnglish: false, invitedAt: 1, invitedBy: 'other' },
    ];

    const result = await capturedDeleter.fn?.({ userId: 'u1', tenantId: 't1', db: fakeDb });
    expect(result).toBeDefined();

    expect(store.projects).toEqual([expect.objectContaining({ id: 'proj-2' })]);
    expect(store.content_block_groups).toEqual([]);
    expect(store.content_blocks).toEqual([]);
    // mem-1 (on u1's own project) and mem-2 (u1's own membership elsewhere) are both gone.
    expect(store.project_members).toEqual([]);
    expect(result?.deleted).toBeGreaterThan(0);
  });
});
