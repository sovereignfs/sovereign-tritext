# CLAUDE.md

Guidance for Claude Code working in this repository (`sovereign-tritext`).

## What this is

Tritext — a trilingual (Sinhala/Tamil/English) content and translation
management app, built as a [Sovereign](https://github.com/sovereignfs/sovereign)
plugin. For the product concept, problem statement, and target users, see
[SPEC.md](SPEC.md). For the phase-by-phase task index, see
[roadmap.md](roadmap.md). This file holds architecture detail, SDK usage
rules, requirements, and the decisions behind them — read it before making
any implementation choice that isn't already spelled out in the code.

## Working conventions

- Developed in-tree against a local Sovereign platform checkout via the
  documented `.local` convention: cloned at
  `plugins/sovereign-tritext.local/` in the platform repo, gitignored there,
  a full pnpm workspace member (see the platform repo's
  `docs/plugin-development.md` → "Developing a sovereign plugin inside the
  platform monorepo"). This repository is the single source of truth for
  the plugin's own source and history — the platform repo never tracks it.
- One phase = one branch = one PR, same discipline as the platform repo.
  Phases are sequenced in [roadmap.md](roadmap.md) — don't skip ahead.
- Schema files live at `app/_lib/db/schema.ts` / `app/_lib/db/schema.postgres.ts`
  — **not** a plugin-root `db/` sibling of `app/`, despite that being the
  documented convention in the platform repo's `docs/plugin-development.md`.
  Reason: the platform's dev-mode composition (`scripts/generate-registry.ts`
  → `syncDir`) copies only a plugin's `app/` directory into the runtime;
  a relative import reaching outside it (`'../db/schema'`) 404s in dev
  (`Module not found`) even though it happens to resolve in production,
  where `app/` is symlinked rather than copied. Keeping schema files inside
  `app/` sidesteps the gap without needing a platform fix. `migrations/`
  stays at the plugin root — it's read directly off disk by the platform's
  migration runner, never bundled, so it isn't affected.
- Regenerate migrations with `pnpm db:generate` after any `app/_lib/db/schema.ts`
  change, then manually fix the Postgres FK-qualification issue described in
  `app/_lib/db/schema.postgres.ts` before committing.
- Verify before claiming a phase done: `pnpm typecheck`, `pnpm eslint`,
  `pnpm prettier --check` at minimum; apply generated SQL to a scratch
  SQLite file after any schema change.
- Package name is `@sovereignfs/plugin-tritext` for in-tree development only
  (matches `plugins/account`/`plugins/console`'s `@sovereignfs/plugin-<slug>`
  convention in the platform repo) — this is not the published package name
  once distributed standalone.

## Architecture

### Manifest summary

| Field         | Value                                                                       |
| ------------- | ---------------------------------------------------------------------------- |
| `id`          | `com.mooniak.tritext`                                                       |
| `type`        | `sovereign`                                                                 |
| `database`    | `isolated`                                                                  |
| `routePrefix` | `/tritext`                                                                  |
| `shell`       | `default`                                                                   |
| `permissions` | `auth:session`, `db:readWrite`, `storage:readWrite`, `notifications:send`   |

Current, authoritative fields live in `manifest.json` — the table above is a
summary as of Phase 1 (monetization not yet added, see "Monetization"
below).

### Data model

Isolated store (own SQLite file / Postgres schema — see the platform repo's
`docs/plugin-database.md`). Schema: `app/_lib/db/schema.ts` (application-facing,
SQLite-typed) and `app/_lib/db/schema.postgres.ts` (structural mirror,
migration-generation only) — see "Working conventions" above for why these
live under `app/` rather than the platform's documented plugin-root `db/`.

| Table                  | Purpose                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `projects`               | A trilingual content project: title, languages enabled, owner            |
| `content_block_groups`   | Collapsible sections within a project                                    |
| `content_blocks`         | The unit of content: per-language text (Lexical JSON), status, locks     |
| `project_members`        | Collaborator roles + per-language edit permission, by platform user id   |
| `custom_fonts`           | Admin-uploaded webfonts for Sinhala/Tamil scripts (`sdk.storage`-backed)  |

`tenant_id` on every table (multi-tenancy readiness; v1 is single-tenant).
`owner_user_id` / `user_id` / `invited_by` / `created_by` reference platform
users by opaque id — **never a local FK**, since an isolated store cannot
join across to the platform DB. Resolve display info via
`sdk.directory.resolveUsers()`.

### Collaborator model

**Rule: no in-plugin invite-by-email flow.** Adding a collaborator resolves
an *existing* platform user via `sdk.directory.searchUsers()` and inserts a
`project_members` row. Someone without a platform account gets one through
the instance's own account-creation path first, then is added to the
project. Notify additions with `sdk.notifications.send()`, not email.

### Custom fonts

**Rule: use `sdk.storage`, never a bespoke bucket or public URL.** Uploads
go through `sdk.storage.put()` (key: `fonts/<fontId>/<filename>`);
`custom_fonts.storage_key` stores the key, not a public URL. Serving uses
`sdk.storage.getSignedUrl()` for `@font-face` `src`. Requires the
`storage:readWrite` permission.

### Monetization

`type: "sovereign"` plugins may declare a `monetization` block gated by an
author-held Ed25519 keypair (RFC 0003 in the platform repo). Route-level
entitlement gating is enforced by the platform itself — **no `sdk.billing`
calls are needed** for a single-tier paywall. As of Phase 9, `manifest.json`
declares `model: "one_time"` with a real `license.publicKey`. The matching
private key is held only by the developer (outside this repo, outside the
platform monorepo, outside any scratchpad) — it was never committed and
never will be; a compromised or lost key means re-keying the manifest and
re-issuing every license token.

### Ported from the prototype

**Dropped** (the Sovereign platform already covers these — do not
reimplement): auth/login, landing page, terms, password reset, account
profile — all replaced by the platform's own auth and Account plugin. The
prototype's global `is_super_admin` role is replaced by a project-scoped
owner/admin concept, not a new global role table.

**Ported near-verbatim** (pure logic, no backend coupling in the original):
the structure/semantic linting engine and its test suite; the DOCX
generator; the Lexical editor internals (styling rewritten to CSS Modules).

**Deferred**: real-time presence / live block sync. The prototype used
Supabase Realtime channels; Sovereign's `sdk.events` pub/sub is not
implemented yet (throws `NotImplementedError`). If collaborator awareness is
needed before that lands, approximate with a polled heartbeat row rather
than waiting — not part of the core port.

## Software Requirements

### User roles

- **Project owner** — `projects.owner_user_id`; implicit full control, not a
  `project_members` row.
- **Admin** (`project_members.role = 'admin'`) — manage members, fonts,
  project settings.
- **Editor** (`role = 'editor'`) — edit content per their per-language
  `can_edit_*` flags.
- **Viewer** (`role = 'viewer'`) — read-only.

### Functional requirements

| ID  | Requirement                                                                     |
| --- | -------------------------------------------------------------------------------- |
| F1  | Create, list, and configure projects (languages enabled, primary language)       |
| F2  | Organize content into collapsible block groups                                  |
| F3  | Edit per-language content in a rich-text editor with debounced autosave         |
| F4  | Reorder blocks and groups via drag-and-drop                                     |
| F5  | Manage collaborators and their per-language edit permissions                    |
| F6  | Run structure/semantic linting across enabled languages                         |
| F7  | Export a project to DOCX (per-language or per-section layout)                   |
| F8  | Upload and manage custom webfonts for Sinhala/Tamil scripts                      |
| F9  | Gate the plugin's routes behind a purchased license once monetization is enabled |

### Non-functional requirements

- Isolated database store — no cross-plugin SQL joins; blast-radius
  contained; dropped wholesale on uninstall.
- Application code stays on the SQLite-typed schema even against a
  Postgres-backed client — no native Postgres `boolean`/`bigint` columns.
- SDK boundary compliance: only `@sovereignfs/sdk` and `@sovereignfs/ui`
  imports, never a platform-internal package.
- No realtime dependency in v1 — every feature must work with request/response
  + client-side polling only.

### Out of scope (v1)

Live presence/collaborative editing, public share links, machine translation,
multi-organization/multi-tenant UI (the `tenant_id` column exists for future
readiness only), automated payment collection beyond the manual/PayPal/Stripe
adapters RFC 0003 already defines at the platform level.

## Decision Log

| Decision                                                             | Rationale                                                                                                                          |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone repo (`sovereign-tritext`), not a `plugins/` monorepo entry | Vertical product plugin, not core platform infra — matches the `sovereign-tasks`/`sovereign-plainwrite` precedent                     |
| `database: "isolated"`, not `shared`                                    | No other plugin needs to join against project/content data; clean uninstall; blast-radius containment                                |
| Collaborators via `sdk.directory`, not an in-plugin invite/email flow   | The platform already owns account creation; duplicating it would fight the single-tenant-multi-user model instead of using it        |
| Custom fonts via `sdk.storage`, not a bespoke bucket                    | `sdk.storage` already provides scoped, quota-limited, private-by-default object storage — no reason to reinvent it                    |
| Realtime presence deferred, not approximated immediately               | `sdk.events` is unimplemented; building a bespoke polling system for a feature the platform will eventually provide natively is waste |
| Monetization: `one_time` model, deferred to Phase 9                    | Simplest model to start with (no `interval`/tiers complexity); avoids shipping an invalid manifest before a real keypair exists       |
| Schema files under `app/_lib/db/`, not a plugin-root `db/` sibling      | Platform's dev-mode composition only copies `app/` into the runtime — a `'../db/schema'` import 404s in dev despite working in prod (symlinked). Discovered during Phase 2; see "Working conventions" above. Worth a platform-level fix (`scripts/generate-registry.ts`) but out of scope for this plugin repo. |
| Package name `@sovereignfs/plugin-tritext` (in-tree dev only)          | Matches `plugins/account`, `plugins/console`'s `@sovereignfs/plugin-<slug>` convention for local development against the workspace    |
| Trilingual (3-language) block editor uses a plain CSS grid, not `@sovereignfs/ui`'s `SplitPane`, for 3 panes | `SplitPane`'s API is strictly `primary`/`secondary` (2 panes only, see `packages/ui/src/components/SplitPane/SplitPane.tsx` in the platform repo). Reused for the 2-language case; trilingual falls back to an equal-width, non-resizable grid local to `BlockEditorView`. Discovered during Phase 3. |
| Sync helpers shared by `blocks-actions.ts`/`groups-actions.ts` live in a plain module (`app/_lib/blockSummary.ts`), not either `'use server'` file | Next.js requires every export of a `'use server'` file to be an async function — a synchronous export (`groupIdCondition`, `toBlockSummary`) fails the whole file at build time ("Server Actions must be async functions"), not just a lint warning. Discovered during Phase 4. |
| Move-a-block-between-groups is an explicit "Move to" `Select` per block row, not cross-container `@dnd-kit` drag | Phase 4's deliverable is reordering *within* a group/the groups list, not moving *between* containers — multi-container dnd-kit drag (tracking `onDragOver` to reparent mid-drag) is materially more complex for a capability a plain select already covers acceptably. |
| Drag reorder uses `@sovereignfs/ui`'s `DragHandleRow` + a plain `PointerSensor`/`KeyboardSensor` setup, not `sovereign-tasks`' whole-row-drag/`GripIcon` pattern | `sovereign-tasks` avoided `DragHandleRow` because its fixed-width gutter couldn't align with that plugin's header/add-row indent — no such conflict here. A small dedicated handle target also means no `data-no-dnd` exclusion mechanism is needed for embedded row controls (the "Move to" select, rename input), unlike `sovereign-tasks`' whole-row drag. |
| Collaborator invite UI (`InviteMemberForm`, `searchProjectDirectoryUsers`/`inviteMemberAction` shape) ported from `sovereign-plainwrite`, not built from scratch | `sovereign-plainwrite` already has a working, shipped `sdk.directory.searchUsers`/`resolveUsers` typeahead-invite flow with the same "resolve before insert, notify on add" shape this plugin's Collaborator model requires — reusing the proven pattern instead of re-deriving it. |
| Every `@sovereignfs/ui` `Checkbox` added in Phase 5 passes an explicit unique `id` | `Checkbox` defaults its DOM `id` to `checkbox-${label}` when `id` is omitted. Two unrelated checkbox groups sharing a label on the same page — `InviteMemberForm`'s "Can edit → Sinhala/Tamil/English" and `ProjectSettingsForm`'s pre-existing "Enabled languages" — silently collided on duplicate DOM ids; `MemberRow`'s per-member "Si"/"Ta"/"En" checkboxes would collide across members the same way. Discovered during Phase 5 — any future `Checkbox` reusing a label already used elsewhere on a page it can co-render with needs an explicit `id`. |
| Lint issues (`app/_lib/lint/`) are computed on the fly from stored content, never persisted to a table | Cheap pure-JS over already-loaded Lexical JSON — no cache to invalidate on every edit, no migration for a `lint_issues` table, and it's trivially always correct (can never drift from the content it describes). Recomputed both server-side (`BlockSummary.issueCount`, per block list row) and client-side, live, in `LintPanel` — the two call sites share the same `lintBlock` engine so they can never disagree. |
| DOCX export (`app/export/[projectId]/route.ts`) is a plugin-owned Route Handler, not a Server Action | Server Actions can't set response headers (no `Content-Disposition: attachment`) and can't stream a binary body — a Server Action returning base64 would need client-side Blob-URL plumbing just to trigger a real filename'd download. A plain `GET` under the plugin's own `routePrefix` is gated by the normal session middleware exactly like a page, and a top-level navigation to it downloads without leaving the current page. Precedent: `plugins/example-api`'s `app/serve/[slug]/[...path]/route.ts` shows plugins may add their own Route Handlers; this one needs no special manifest flag (that example's `apiProvider: true` is for a different, externally-authenticated use case). |
| `generateProjectDocx`/`lexicalToDocx.ts` are DB-independent — `exportData.ts` is the only file in `_lib/docx/` that queries the database | Keeps the actual document-generation logic (and its test suite) fully unit-testable with in-memory fixtures, no DB fixture setup needed. |
| DOCX generation tests unzip the packed buffer with `jszip` (a test-only devDependency) rather than asserting on `Paragraph` object internals or `Packer.toString` | `docx`'s `Packer.toString` returns the raw packed ZIP bytes as a string, not readable XML — despite the name. `Paragraph`/`TextRun` instances have no public API for introspecting their own content. Unzipping `word/document.xml` (via `Packer.toBuffer` + `jszip`) is the only way to assert on real generated content (headings, bold runs, bullet numbering) rather than just paragraph counts. |
| Custom fonts (`custom_fonts` table) are tenant-wide, and their management UI is gated by *whichever* project's owner/admin check the admin happens to be viewing, not a dedicated instance-admin role | Tritext has no instance-level admin concept of its own (only per-project owner/admin/editor/viewer) and `custom_fonts` carries no `project_id` (deliberate — one font library shared across every project in the tenant, matching CLAUDE.md's Data model). Phase 8 reuses Phase 5's project-admin check as the only gate available, accepting that an admin of Project A can add/remove tenant-wide fonts from Project A's page even though the effect is visible in Project B too. |
| `familyName` is restricted to `/^[a-zA-Z0-9 _-]+$/` at upload time (`fonts-actions.ts`) | It flows unescaped into `app/layout.tsx`'s injected `<style>` tag (`fontFaceCss`) — CSS has no general-purpose string-escaping mechanism to sanitize it at render time instead, so the only safe point to enforce this is before it's ever stored. |
| `app/layout.tsx` renders only a `<style>` tag and `{children}` — no wrapping element | Every existing page already owns its own root layout div (`.page`, `.blockEditorPage`) with its own padding; a layout that also added a wrapping `<main>` (the pattern `sovereign-plainwrite`/`sovereign-tasks` use) would double up spacing across every page, since none of Tritext's pages were built expecting a layout-level wrapper. |
| Ed25519 private key generated once for Phase 9, never persisted to any file in either repo or the scratchpad | The manifest only ever needs the public key; a plaintext private-key file sitting in a git-ignored `.local` checkout is still a real leak surface (backups, shared machines, accidental `git add -f`). Handed directly to the developer in chat instead, with the instruction to move it into a password manager themselves. |
| Phase 10 test coverage targets pure `app/_lib/` helpers (`fontFace`, `plainText`, `access`, `blockSummary`) rather than literally porting 5 suites from the prototype | No prototype source is available in this environment to port from. Testing the pure, DB-independent logic modules that had zero coverage achieves the same underlying goal — real unit coverage of business logic, not just typecheck — without a source repo to draw from. |
| Per-language block status (`aggregateStatus`, `updateBlockLanguageStatusAction`) wired up in Phase 11, not earlier | The `sinhala_status`/`tamil_status`/`english_status`/`status` columns existed since Phase 1's schema and SPEC.md's problem statement explicitly promises per-language status, but no phase before the polish pass built the action or UI for it — every block was permanently `'draft'`. A block's aggregate `status` is the least-advanced of its enabled languages' statuses (mirrors real translation-workflow semantics: a block isn't "approved" until every language is), computed in the pure, tested `_lib/blockStatus.ts`, not inline in the server action. |
| `characterLimit`/`wordLimit`/`notes`/`is*Locked` columns on `content_blocks` are left unwired | Present since Phase 1's schema (ported from the prototype) but never read or written by any action or UI, and — unlike status — not part of this plugin's own SPEC.md. Wiring them up would be a new feature, not a polish fix; flagged here rather than built speculatively during Phase 11. |
| `.uploadForm`/`.uploadFormSubmit` added as siblings to `.inviteForm` instead of reusing it for the font-upload form | `.inviteForm` uses `align-items: flex-end`, which assumes same-height fields — correct for the member-invite form's 3 single-line fields, wrong for the font form's multi-checkbox "Scripts" fieldset (much taller), which crowded the submit button against the fieldset. A form-specific class was simpler and safer than adding a variant prop to a shared class used elsewhere. |
| Font-upload file field (Phase 12) uses `@sovereignfs/ui`'s `FileDropzone`, not a locally-styled `<input type="file">` | The raw native input rendered as an unstyled browser-default control that didn't match the rest of the form — flagged during a UX review. Rather than hand-rolling a third copy of the dropzone pattern (the Account plugin already had one), the component was extracted into the platform's design system and this plugin became a consumer, per CLAUDE.md's DS-first policy. |
