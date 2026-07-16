import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Tritext schema (SQLite dialect) — the schema application code queries
 * against. `database: "isolated"` in manifest.json means this plugin owns a
 * dedicated store, so table names carry no slug prefix.
 *
 * Conventions (matching the platform's own schema):
 * - IDs are `crypto.randomUUID()` strings, supplied by the caller at insert
 *   time (no DB-generated default).
 * - Timestamps are Unix epoch **seconds** stored as `integer`, supplied by
 *   the caller (`Math.floor(Date.now() / 1000)`) — no SQL-side defaults, so
 *   the schema stays dialect-portable.
 * - Booleans are `integer` with Drizzle's `mode: 'boolean'` (0/1 underneath).
 * - `tenant_id` is present on every user-scoped table even though v1 is
 *   single-tenant (multi-tenancy readiness).
 * - `owner_user_id` / `user_id` / `invited_by` / `created_by` reference
 *   platform users, not a local table — this plugin's isolated store cannot
 *   FK across to the platform DB. Resolve display info via
 *   `sdk.directory.resolveUsers()`.
 *
 * See `./schema.postgres.ts` for the Postgres mirror used only to generate
 * Postgres migrations — application code never imports it.
 */

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  deadline: integer('deadline'),
  languageMode: text('language_mode').notNull().default('trilingual'),
  // JSON array of language codes, e.g. ["sinhala","tamil","english"].
  enabledLanguages: text('enabled_languages').notNull(),
  primaryLanguage: text('primary_language').notNull().default('sinhala'),
  ownerUserId: text('owner_user_id').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const contentBlockGroups = sqliteTable('content_block_groups', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  name: text('name').notNull(),
  orderNumber: integer('order_number').notNull().default(0),
  isCollapsed: integer('is_collapsed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const contentBlocks = sqliteTable('content_blocks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  groupId: text('group_id').references(() => contentBlockGroups.id),
  // 'text' | 'heading' | 'list' | 'quote'
  blockType: text('block_type').notNull().default('text'),
  // Lexical editor state, JSON-stringified — or plain text as a fallback for
  // content that predates the rich-text editor. Parsed defensively, not with
  // `{ mode: 'json' }`, since a plain-text fallback value isn't valid JSON.
  sinhalaText: text('sinhala_text'),
  tamilText: text('tamil_text'),
  englishText: text('english_text'),
  // 'draft' | 'in_review' | 'approved', per language and overall.
  status: text('status').notNull().default('draft'),
  sinhalaStatus: text('sinhala_status').notNull().default('draft'),
  tamilStatus: text('tamil_status').notNull().default('draft'),
  englishStatus: text('english_status').notNull().default('draft'),
  characterLimit: integer('character_limit'),
  wordLimit: integer('word_limit'),
  orderNumber: integer('order_number').notNull().default(0),
  notes: text('notes'),
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
  sinhalaLocked: integer('sinhala_locked', { mode: 'boolean' }).notNull().default(false),
  tamilLocked: integer('tamil_locked', { mode: 'boolean' }).notNull().default(false),
  englishLocked: integer('english_locked', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const projectMembers = sqliteTable('project_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id),
  // Platform user id, resolved via sdk.directory — not a local FK.
  userId: text('user_id').notNull(),
  // 'viewer' | 'editor' | 'admin'
  role: text('role').notNull().default('viewer'),
  canEditSinhala: integer('can_edit_sinhala', { mode: 'boolean' }).notNull().default(false),
  canEditTamil: integer('can_edit_tamil', { mode: 'boolean' }).notNull().default(false),
  canEditEnglish: integer('can_edit_english', { mode: 'boolean' }).notNull().default(false),
  invitedAt: integer('invited_at').notNull(),
  invitedBy: text('invited_by'),
});

export const customFonts = sqliteTable('custom_fonts', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  familyName: text('family_name').notNull(),
  displayName: text('display_name').notNull(),
  // sdk.storage key (e.g. "fonts/<fontId>/<filename>"), not a public URL.
  storageKey: text('storage_key').notNull(),
  // JSON array of script tags, e.g. ["sinhala","tamil"].
  supportedScripts: text('supported_scripts').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  orderNumber: integer('order_number').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  createdBy: text('created_by'),
});
