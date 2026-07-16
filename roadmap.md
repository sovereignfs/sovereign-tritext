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
| 5     | Collaborators via `sdk.directory` | 📋     | [F5, Collaborator model](CLAUDE.md#collaborator-model)             |
| 6     | Linting engine port               | 📋     | [F6](CLAUDE.md#functional-requirements)                            |
| 7     | DOCX export                       | 📋     | [F7](CLAUDE.md#functional-requirements)                            |
| 8     | Custom fonts via `sdk.storage`    | 📋     | [F8, Custom fonts](CLAUDE.md#custom-fonts)                         |
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

#### 📋 Phase 5 — Collaborators via `sdk.directory`

**Goal:** Add/remove project collaborators and manage per-language edit
permissions, without an in-plugin invite/email flow.

**Deliverables:** `project_members` UI, `sdk.directory.searchUsers`/
`resolveUsers` integration, permission checks in every mutating server
action (not just the UI).

**Dependencies:** Phase 2 shell

---

#### 📋 Phase 6 — Linting engine port

**Goal:** Structure/semantic cross-language consistency checks, surfaced in
a lint panel.

**Deliverables:** ported `LintEngine`/`rules/structure.ts`/`rules/semantic.ts`
+ their test suite, `LintPanel` UI.

**Dependencies:** Phase 3 editor (needs real block content to lint)

---

#### 📋 Phase 7 — DOCX export

**Goal:** Export a project to a DOCX file, per-language or per-section.

**Deliverables:** server action wrapping the ported `generateDocx.ts` logic.

**Dependencies:** Phase 4 (export needs stable ordering)

---

#### 📋 Phase 8 — Custom fonts via `sdk.storage`

**Goal:** Admin-managed webfont upload/serving for Sinhala/Tamil scripts.

**Deliverables:** upload UI, `sdk.storage.put`/`getSignedUrl`/`list`/`delete`
wiring, `@font-face` injection.

**Dependencies:** Phase 5 (uses the same project-admin role check)

---

#### 📋 Phase 9 — Monetization (paywall)

**Goal:** Turn on the purchase gate.

**Deliverables:** author Ed25519 keypair generated and kept outside the
repo; `monetization` block added to `manifest.json` (`model: "one_time"`);
verified against a real platform instance that `/tritext` is blocked without
a license and unblocked with one.

**Dependencies:** none technically, but done last so every feature is
already built and testable before the paywall is live

---

#### 📋 Phase 10 — Polish, tests, docs

**Goal:** Ready for real use.

**Deliverables:** ported vitest suites (5 from the prototype, plus new
coverage for anything Sovereign-specific), final README, self-host install
notes for other Sovereign instances.
