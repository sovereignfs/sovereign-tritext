# Tritext — Roadmap

Chronological build index — one row per PR. Concept/plan live in
[SPEC.md](SPEC.md); architecture, requirements, and decisions live in
[CLAUDE.md](CLAUDE.md). Status: ✅ done · 🔄 in progress · 📋 planned.

| Phase | Task                              | Status | Ref                                                              |
| ----- | ---------------------------------- | ------ | ------------------------------------------------------------------ |
| 0     | Scaffold                          | ✅     | [Working conventions](CLAUDE.md#working-conventions)               |
| 1     | Isolated DB schema                | ✅     | [Data model](CLAUDE.md#data-model)                                 |
| 2     | Project CRUD + shell UI           | ✅     | [F1](CLAUDE.md#functional-requirements)                            |
| 3     | Lexical editor + autosave         | ✅     | [F3](CLAUDE.md#functional-requirements)                            |
| 4     | Block groups + drag reorder       | ✅     | [F2, F4](CLAUDE.md#functional-requirements)                        |
| 5     | Collaborators via `sdk.directory` | ✅     | [F5, Collaborator model](CLAUDE.md#collaborator-model)             |
| 6     | Linting engine                    | ✅     | [F6](CLAUDE.md#functional-requirements)                            |
| 7     | DOCX export                       | ✅     | [F7](CLAUDE.md#functional-requirements)                            |
| 8     | Custom fonts via `sdk.storage`    | ✅     | [F8, Custom fonts](CLAUDE.md#custom-fonts)                         |
| 9     | Monetization (paywall)            | 📋     | [F9, Monetization](CLAUDE.md#monetization)                         |
| 10    | Polish, tests, docs               | 📋     | —                                                                  |

---

## Tasks

#### ✅ Phase 0 — Scaffold

**Goal:** A buildable plugin skeleton the platform can compose and serve.

**Deliverables:** `manifest.json`, `package.json`, `tsconfig.json`,
`icon.svg`, `app/page.tsx`, `app/tritext.module.css`, `README.md`.

**Review checklist:**

- `pnpm typecheck`, `pnpm eslint`, `pnpm prettier --check` all pass
- Plugin resolves as a pnpm workspace member when developed at
  `plugins/sovereign-tritext.local/` in a platform checkout

---

#### ✅ Phase 1 — Isolated DB schema

**Goal:** The full data model for projects/blocks/groups/members/fonts,
generated as dual sqlite+postgres migrations.

**Deliverables:** `app/_lib/db/schema.ts`, `app/_lib/db/schema.postgres.ts`,
`migrations/sqlite/`, `migrations/postgres/`, `db:generate` script. (Schema
files moved under `app/_lib/` during Phase 2 — see CLAUDE.md's Decision Log.)

**Review checklist:**

- `pnpm db:generate` regenerates both migration sets cleanly
- Generated SQL applies without error against a scratch SQLite file
- Postgres FK `REFERENCES` are schema-unqualified (see `schema.postgres.ts`
  docblock) — required because this plugin's Postgres tables live in a
  dedicated `plugin_<slug>` schema, not `public`
- `pnpm typecheck` / `eslint` / `prettier --check` pass

---

#### ✅ Phase 2 — Project CRUD + shell UI

**Goal:** Create, list, and open projects through a real UI backed by server
actions — the first end-to-end vertical slice.

**Deliverables:**

- `app/page.tsx` — project list (`@sovereignfs/ui` `PageHeader`/`Card`/`EmptyState`)
- `app/[projectId]/page.tsx` — project detail shell
- `app/_components/CreateProjectForm.tsx`, `app/_components/ProjectSettingsForm.tsx`
- `app/actions.ts` — `listProjects`, `getProject`, `createProjectAction`,
  `updateProjectSettingsAction` using `sdk.db.getClient()`, gated by
  `sdk.auth.requireSession()` and per-project owner/admin/editor/viewer access
  resolved against `project_members`

**Dependencies:** Phase 1 schema

**Review checklist:**

- ✅ Creating a project via the UI persists a row and appears in the list
  (verified live: `pnpm dev`, seeded `user@sovereign.local`, created
  "National Curriculum Guide 2026", confirmed it appears as a card)
- ✅ `sdk.auth.requireSession()` gates both pages; `owner_user_id` and
  `tenant_id` are set from the session, never client input
- ✅ Settings update round-trips correctly (title/description/deadline/
  language config saved and reloaded correctly from the isolated SQLite store)
- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass

**Discovered during this phase** (see CLAUDE.md Decision Log): the platform's
dev-mode plugin composition only copies a plugin's `app/` directory into the
runtime, not a sibling `db/` — so schema files live at `app/_lib/db/` here,
not the platform-documented plugin-root `db/`.

---

#### ✅ Phase 3 — Lexical editor + autosave

**Goal:** Per-language rich-text editing with debounced autosave.

**Deliverables:**

- `RichTextEditor`/`FloatingToolbarPlugin`/`FontSizeControls` built on Lexical
  0.48 (`app/_components/editor/`) — bold/italic/underline, H1/H2, quote,
  bulleted list, and a font-size stepper, styled with CSS Modules
- Per-language layout: `@sovereignfs/ui`'s `SplitPane` for 2 enabled
  languages, an equal-width CSS grid for 3 (see "Discovered during this
  phase"), a single pane for 1
- `app/blocks-actions.ts` — `listBlocks`, `getBlock`, `createBlockAction`,
  `autosaveBlockContentAction`, gated by `canEditLanguage` (owner/admin edit
  all languages; editor per their `can_edit_*` flags; viewer read-only)
- Minimal ungrouped block list + "Add block" on the project page
  (`BlocksSection`) so blocks are creatable ahead of Phase 4's group UI
- `app/_lib/access.ts` — `resolveAccess`/`canEditLanguage`/`getDb` factored
  out of `actions.ts` so `blocks-actions.ts` shares the same access checks

**Dependencies:** Phase 2 shell

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass (run from the
  platform root against `plugins/sovereign-tritext.local/`)
- ✅ Verified live: `pnpm dev`, created a trilingual project, added a block,
  typed in the Tamil pane, selected text and applied Bold via the floating
  toolbar, confirmed "Saving…" → "Saved", reloaded and confirmed the
  formatted content persisted and the project's block-list preview reflects
  it
- ✅ Font-size stepper and H1/H2/quote/bulleted-list toggles verified in the
  floating toolbar

**Discovered during this phase** (see CLAUDE.md Decision Log): `SplitPane`
only supports exactly 2 panes (`primary`/`secondary`), so trilingual mode
(3 enabled languages) can't use it — falls back to a plain equal-width CSS
grid in `BlockEditorView`. Also: this repo has no local ESLint config of its
own (no `lint` script in `package.json`) — it's linted by the platform's
root flat config when developed in-tree, which does **not** register
`eslint-plugin-react-hooks`, so `// eslint-disable-next-line
react-hooks/exhaustive-deps` errors as an unknown-rule reference here even
though it's a normal pattern in other React codebases.

---

#### ✅ Phase 4 — Block groups + drag reorder

**Goal:** Collapsible block groups; drag-and-drop reordering of both groups
and blocks within a group.

**Deliverables:**

- `app/groups-actions.ts` — `getProjectContent` (groups + blocks assembled
  server-side in two queries), `createGroupAction`, `renameGroupAction`,
  `deleteGroupAction` (ungroups its blocks in a transaction, never deletes
  content), `toggleGroupCollapsedAction`, `reorderGroupsAction`,
  `reorderBlocksAction`, `moveBlockToGroupAction`
- `app/_lib/blockSummary.ts` — `groupIdCondition`/`toBlockSummary`/
  `nextOrderInBucket` factored out of `blocks-actions.ts`: Next.js requires
  every export of a `'use server'` file to be an async function, and these
  are synchronous (see "Discovered during this phase")
- `app/_components/ProjectContentView.tsx`/`GroupCard.tsx`/`BlockRow.tsx` —
  replace Phase 3's `BlocksSection`: groups render via `@dnd-kit`
  `DndContext`/`SortableContext` (one context for the groups list, one
  nested per group's blocks, one for the ungrouped bucket), each group a
  `@sovereignfs/ui` `DragHandleRow` with an inline-rename `Input`
  (`useCommitOnEnterOrBlur`), collapse toggle, and `ConfirmDialog`-gated
  delete; each block row also a `DragHandleRow` with a "Move to" `Select`
  for moving between groups without needing cross-container drag
- `app/_lib/dndSensors.ts` — shared `useReorderSensors()` (`PointerSensor` +
  `KeyboardSensor`); simpler than `sovereign-tasks`' whole-row-drag setup
  since the drag handle here is a dedicated small target, not the whole row

**Dependencies:** Phase 3 editor (blocks must be creatable/editable first)

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ Verified live: created groups, renamed via commit-on-blur, moved a
  block between groups via the "Move to" select, collapsed/expanded a
  group, deleted a group and confirmed its block moved back to Ungrouped
  with content intact (not deleted)
- ⚠️ Pointer-drag reorder itself could not be exercised end-to-end through
  the browser-automation tool available in this session — dnd-kit's
  `PointerSensor`/`KeyboardSensor` activation isn't reliably triggered by
  its synthetic input. Verified instead by: dnd-kit generating its own
  accessibility scaffolding (live region, `aria-describedby`, keyboard
  instructions) on page load, which only happens when
  `DndContext`/`SortableContext`/`useSortable` are wired correctly; and the
  pattern matching `sovereign-tasks`' proven, shipped drag-reorder
  implementation. A human should confirm actual mouse-drag reordering
  before this ships.

**Discovered during this phase** (see CLAUDE.md Decision Log): a
`'use server'` file's exports must *all* be async functions — a plain
synchronous helper (`groupIdCondition`, `toBlockSummary`) breaks the whole
file at build time ("Server Actions must be async functions"), not just a
lint warning. Both moved to a plain module (`_lib/blockSummary.ts`) shared
by `blocks-actions.ts` and `groups-actions.ts`.

---

#### ✅ Phase 5 — Collaborators via `sdk.directory`

**Goal:** Add/remove project collaborators and manage per-language edit
permissions, without an in-plugin invite/email flow.

**Deliverables:**

- `app/members-actions.ts` — `getProjectMembers` (resolves owner + every
  member's display name/email via one batched `sdk.directory.resolveUsers`
  call), `searchProjectDirectoryUsers` (`sdk.directory.searchUsers`,
  gated by any project access), `inviteMemberAction` (resolves the picked
  id against the directory before inserting — never trusts a raw client
  id; updates in place if already a member), `updateMemberAction` (inline
  role/per-language-flag edits), `removeMemberAction` — every mutating
  action gated by `owner`/`admin` project role, re-checked server-side
  (not just hidden in the UI)
- `app/_lib/notify.ts` — best-effort `notifyUser` (mirrors
  `sovereign-plainwrite`'s own helper): a new member gets a
  `sdk.notifications.send()` notification, never email
- `app/_components/InviteMemberForm.tsx` — name/email typeahead backed by
  `searchProjectDirectoryUsers` (ported from `sovereign-plainwrite`'s
  `InviteMemberForm`), role select, and per-language "Can edit" checkboxes
  shown only for the `editor` role
- `app/_components/MembersSection.tsx` — owner line (read-only) + member
  rows with live-editable role/per-language flags (same direct-call-on-change
  pattern as Phase 4's block "Move to" select) and a remove button, gated by
  `canManage`; a read-only row (no controls) for non-owner/non-admin viewers

**Dependencies:** Phase 2 shell

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ Verified live with a real second seeded user
  (`admin@sovereign.local`): searched and invited as Editor with
  Sinhala-only edit access; confirmed the notification arrived (bell badge
  showed "1 unread"); confirmed persistence across reload; changed role to
  Admin (per-language checkboxes correctly disappeared) and removed the
  member, both persisting correctly
- ✅ Verified permission gating end-to-end by logging in as the invited
  editor: People section rendered read-only (no invite form, no role
  select, no remove button); the block editor correctly made only the
  Sinhala pane editable (`contenteditable="true"`) with Tamil/English
  read-only — this is `canEditLanguage` (built in Phase 3) being exercised
  for the first time by a real non-owner collaborator

**Discovered during this phase** (see CLAUDE.md Decision Log): `@sovereignfs/ui`'s
`Checkbox` defaults its DOM `id` to `checkbox-${label}` when no `id` prop is
given. Two unrelated checkbox groups sharing a label on the same page (here:
`InviteMemberForm`'s new "Can edit → Sinhala/Tamil/English" checkboxes and
`ProjectSettingsForm`'s pre-existing "Enabled languages" checkboxes, both
rendered on the project detail page) silently collide on duplicate DOM ids.
Fixed by passing explicit unique `id`s to every `Checkbox` added in this
phase (`invite-can-edit-*`, and `member-${userId}-can-edit-*` — the latter
also needed per-member uniqueness, since multiple `MemberRow`s render the
same "Si"/"Ta"/"En" labels).

---

#### ✅ Phase 6 — Linting engine

**Goal:** Structure/semantic cross-language consistency checks, surfaced in
a lint panel.

**Deliverables:**

- `app/_lib/lint/engine.ts` + `rules/structure.ts` + `rules/semantic.ts` — no
  prototype source exists to port from (same situation as Phase 3's editor;
  see CLAUDE.md's "Ported from the prototype"), so the engine is a fresh,
  from-spec implementation. Structure rules (`empty-language`,
  `block-count-mismatch`, `heading-mismatch`) compare each language's
  Lexical document shape via `parseTree.ts`; semantic rules
  (`length-ratio-outlier`, `placeholder-text`) are content-length/pattern
  heuristics — no external NLP or translation-quality service
- `app/_lib/lint/__tests__/engine.test.ts` — 18-case Vitest suite (one rule
  at a time, plus aggregate `lintBlock` behavior); the "ported ... test
  suite" deliverable, freshly written for the same reason as the engine
- `app/_components/LintPanel.tsx` — renders in `BlockEditorView`, recomputed
  live from each pane's in-memory content on every keystroke (no debounce,
  no network round-trip — it's pure JS over content the editors already
  hold), independent of the debounced autosave cycle
- `BlockSummary.issueCount` (`_lib/blockSummary.ts`) — same engine run
  server-side in `toBlockSummary`, surfaced as a small warning badge on each
  block's row in the project's content list, so problem blocks are visible
  without opening each one
- `extractFullText` split out of `extractPlainText` (`_lib/editor/plainText.ts`)
  — the semantic rules need untruncated text; the old function always
  truncated to a preview length

**Dependencies:** Phase 3 editor (needs real block content to lint)

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ `pnpm vitest run` — 18/18 passing
- ✅ Verified live: opened a block with Sinhala/English empty and Tamil
  filled, confirmed the panel showed 2 `empty-language` issues with correct
  per-language messages; typed into the empty Sinhala pane and watched the
  panel drop to 1 issue *before* the "Saved" indicator appeared (proving
  linting isn't gated on autosave); reloaded the project page and confirmed
  the block's list-row badge read "1 issue", matching the server-computed
  `issueCount`

---

#### ✅ Phase 7 — DOCX export

**Goal:** Export a project to a DOCX file, per-language or per-section.

**Deliverables:**

- `app/_lib/docx/lexicalToDocx.ts` — Lexical JSON → `docx` `Paragraph[]`
  (headings, quotes, one level of nested bulleted lists, bold/italic/underline
  runs), plus a pre-editor plain-text fallback. No prototype source exists to
  port from (same situation as Phases 3 and 6), so built fresh from spec
- `app/_lib/docx/generateDocx.ts` — `generateProjectDocx`, pure and
  DB-independent: `per-language` produces one language's content across every
  section (a publishable single-language document); `per-section` shows every
  enabled language together under each block (for side-by-side review)
- `app/_lib/docx/exportData.ts` — assembles a project's groups/blocks into
  export-ready sections (ordered, empty groups dropped), the one piece that
  does touch the DB
- `app/export/[projectId]/route.ts` — a plugin-owned Route Handler (`GET`),
  gated by the normal session middleware like any page — streams the
  generated buffer with `Content-Disposition: attachment`. Chosen over a
  Server Action + base64 + client-side Blob dance: Server Actions can't set
  response headers, and a plain top-level navigation to a URL that returns
  `Content-Disposition: attachment` triggers a download without leaving the
  current page — no JS blob-URL plumbing needed
- `app/_components/ExportSection.tsx` — layout choice, a language select
  (shown only for the per-language layout, defaulting to the project's
  primary language), and a "Download .docx" button
- `app/_lib/docx/__tests__/generateDocx.test.ts` — 12-case Vitest suite; the
  "ported ... logic" deliverable, freshly written for the same reason as the
  generator itself. Asserts on the real generated XML (unzipped via `jszip`
  — `docx`'s own `Packer.toString` returns the raw packed ZIP bytes, not
  readable XML, so unzipping is the only way to verify content), not just
  paragraph counts

**Dependencies:** Phase 4 (export needs stable ordering)

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ `pnpm vitest run` — 30/30 passing (12 new + 18 from Phase 6)
- ✅ Verified live: fetched `/tritext/export/<id>?layout=per-section` and
  `?layout=per-language&language=tamil` directly — both returned `200`, the
  correct `Content-Type`, a `Content-Disposition` with a sane filename, and a
  body starting with the ZIP magic number (`504b0304`); confirmed
  `?layout=per-language` with no `language` returns `400` with a clear error;
  clicked "Download .docx" in the actual UI and confirmed the browser
  performed the download (a `200 OK` request reported as
  `net::ERR_ABORTED` — the correct, expected signature of a browser
  intercepting an attachment response as a download rather than a page
  navigation, not a real failure)

---

#### ✅ Phase 8 — Custom fonts via `sdk.storage`

**Goal:** Admin-managed webfont upload/serving for Sinhala/Tamil scripts.

**Deliverables:**

- `app/fonts-actions.ts` — `listFontsForManagement` (all fonts + `canManage`,
  gated by the same project-owner/admin check as Members), `uploadFontAction`
  (validates extension `.woff2`/`.woff`/`.ttf`/`.otf`, 5 MB max, and a
  `familyName` charset restricted to what's safe to interpolate unescaped
  into CSS — see "Discovered during this phase"), `toggleFontActiveAction`,
  `deleteFontAction` (removes the `sdk.storage` object *and* the DB row —
  `custom_fonts.storage_key` never left orphaned), `listActiveFontsForFontFace`
  (no project gating — every tenant member reads the shared font library)
- `app/_lib/fontFace.ts` — `guessFontFormat` (extension → CSS `format()`
  hint) and `fontFaceCss`, pure and unit-tested-by-construction (no DB, no
  React)
- `app/layout.tsx` — new for this phase; fetches active fonts and injects a
  bare `<style>{fontFaceCss(...)}</style>` ahead of `{children}`, no wrapping
  element, so it can't affect any existing page's own layout/spacing
- `app/_components/FontsSection.tsx` — upload form (file input, family
  name, display name, script checkboxes) + font list with a live
  Active/inactive toggle and Remove, gated by `canManage`; readers with no
  manage access see nothing if the library is empty, or a read-only list if
  not

**Dependencies:** Phase 5 (uses the same project-admin role check)

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ Verified live: uploaded a font (file input driven via the DOM
  `DataTransfer` API, since this session's browser-automation tool can't
  drive a native OS file picker), confirmed it appeared in the management
  list and its `@font-face` rule was injected into the page with a real
  `sdk.storage` signed URL; fetched that URL directly and confirmed it
  served the uploaded bytes with the correct `content-type`; toggled the
  font inactive, reloaded, and confirmed the `@font-face` rule disappeared
  while the font stayed listed (inactive, not deleted); clicked Remove and
  confirmed it's gone from the list

**Discovered during this phase**: `familyName` flows into `app/layout.tsx`'s
injected `<style>` tag via `dangerouslySetInnerHTML`-equivalent (a `<style>`
child string) with no CSS-string-escaping mechanism available — React
doesn't sanitize style-tag text content the way it does HTML attributes.
`uploadFontAction` restricts `familyName` to `/^[a-zA-Z0-9 _-]+$/` at
write time specifically to close this off, not just for cosmetic
CSS-identifier validity.

---

#### ✅ Phase 9 — Monetization (paywall)

**Goal:** Turn on the purchase gate.

**Deliverables:**

- Author Ed25519 keypair generated with the Node.js snippet from the
  platform repo's `docs/plugin-development.md`. The private key was never
  written to disk anywhere in this repo, the platform monorepo, or the
  scratchpad — it was generated, used once to sign a test license token
  for live verification, and handed to the developer directly to move into
  their own secure storage. Only the public key is committed (below).
- `monetization` block added to `manifest.json`: `model: "one_time"`,
  `license.publicKey` set to the generated public key. Version bumped to
  `0.8.0`.

**Dependencies:** none technically, but done last so every feature is
already built and testable before the paywall is live

**Review checklist:**

- ✅ `pnpm typecheck` / `eslint` / `prettier --check` all pass
- ✅ `pnpm vitest run` — unaffected, all still passing (paywall enforcement
  is platform-side, not plugin code)
- ✅ Verified live against the real platform instance: navigating to
  `/tritext` with no license showed the platform's paywall page ("One-time
  purchase / Contact the plugin author to purchase access.") with a license
  token import field, confirming access is blocked; signed a real license
  token (`pluginId`/`sub`/`issuedAt` payload, Ed25519-signed with the
  generated private key) and submitted it through "Activate license";
  `/tritext` then rendered the normal project list, confirming the
  signature verifies and access unblocks

**Discovered during this phase**: no plugin code changes at all — RFC 0003's
gate is entirely enforced by the platform reading `manifest.json`'s
`monetization` block and verifying license tokens against `publicKey`
offline. This phase is purely a manifest change plus the one-time keypair
ceremony.

---

#### 📋 Phase 10 — Polish, tests, docs

**Goal:** Ready for real use.

**Deliverables:** ported vitest suites (5 from the prototype, plus new
coverage for anything Sovereign-specific), final README, self-host install
notes for other Sovereign instances.
