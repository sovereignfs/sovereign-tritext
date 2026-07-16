import { integer, pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Tritext schema (Postgres dialect) — a structural mirror of `./schema.ts`
 * used ONLY to generate Postgres migrations via drizzle-kit; application
 * code always queries through the SQLite-typed `./schema.ts`, even against a
 * Postgres-backed client (Drizzle's query builder is bound to the
 * connection, not the table object).
 *
 * Because application code stays on the SQLite-typed schema, every column
 * here must serialize identically to its SQLite counterpart:
 * - Booleans are plain `integer` (0/1), never native Postgres `boolean`.
 * - Timestamps are plain `integer` (Unix epoch seconds), never `bigint` —
 *   this plugin's own query code is not dialect-aware, unlike the platform's
 *   (see `packages/db/src/schema/postgres/platform.ts` for that contrast).
 *
 * A schema-parity mismatch here would fail silently at write time the first
 * time a boolean/timestamp round-trips through the wrong serializer — keep
 * this file in lockstep with `./schema.ts` by hand.
 *
 * `drizzle-kit generate --dialect postgresql` always qualifies FK targets as
 * `"public"."<table>"` when a table has no explicit `pgSchema()` attached —
 * but this plugin's tables live in a dedicated `plugin_<slug>` schema
 * (`pluginSchemaName()` in `packages/db/src/plugin-client.ts`), reached via
 * `search_path`, never `public`. After every `pnpm db:generate` run, manually
 * strip the `"public".` qualifier from any new `ALTER TABLE ... REFERENCES`
 * statement in `migrations/postgres/*.sql` so it resolves via `search_path`
 * like the (correctly unqualified) `CREATE TABLE` statements already do.
 */

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  deadline: integer('deadline'),
  languageMode: text('language_mode').notNull().default('trilingual'),
  enabledLanguages: text('enabled_languages').notNull(),
  primaryLanguage: text('primary_language').notNull().default('sinhala'),
  ownerUserId: text('owner_user_id').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const contentBlockGroups = pgTable('content_block_groups', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  orderNumber: integer('order_number').notNull().default(0),
  isCollapsed: integer('is_collapsed').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const contentBlocks = pgTable('content_blocks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  groupId: text('group_id').references(() => contentBlockGroups.id),
  blockType: text('block_type').notNull().default('text'),
  sinhalaText: text('sinhala_text'),
  tamilText: text('tamil_text'),
  englishText: text('english_text'),
  status: text('status').notNull().default('draft'),
  sinhalaStatus: text('sinhala_status').notNull().default('draft'),
  tamilStatus: text('tamil_status').notNull().default('draft'),
  englishStatus: text('english_status').notNull().default('draft'),
  characterLimit: integer('character_limit'),
  wordLimit: integer('word_limit'),
  orderNumber: integer('order_number').notNull().default(0),
  notes: text('notes'),
  isLocked: integer('is_locked').notNull().default(0),
  sinhalaLocked: integer('sinhala_locked').notNull().default(0),
  tamilLocked: integer('tamil_locked').notNull().default(0),
  englishLocked: integer('english_locked').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const projectMembers = pgTable('project_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  userId: text('user_id').notNull(),
  role: text('role').notNull().default('viewer'),
  canEditSinhala: integer('can_edit_sinhala').notNull().default(0),
  canEditTamil: integer('can_edit_tamil').notNull().default(0),
  canEditEnglish: integer('can_edit_english').notNull().default(0),
  invitedAt: integer('invited_at').notNull(),
  invitedBy: text('invited_by'),
});

export const customFonts = pgTable('custom_fonts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  familyName: text('family_name').notNull(),
  displayName: text('display_name').notNull(),
  storageKey: text('storage_key').notNull(),
  supportedScripts: text('supported_scripts').notNull(),
  isActive: integer('is_active').notNull().default(1),
  orderNumber: integer('order_number').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by'),
});
