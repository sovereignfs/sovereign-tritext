# Tritext

A trilingual (Sinhala / Tamil / English) content and translation management
app, built as a [Sovereign](https://github.com/sovereignfs/sovereign) plugin.

Ported from an earlier prototype ("Tritext Content Hub", a Lovable.dev/Vite/
Supabase app) onto Sovereign's plugin platform: projects containing
collapsible block groups of content blocks, each edited per-language in a
Lexical rich-text editor with auto-save, collaborator roles with per-language
edit permissions, a structure/semantic linting engine that checks
cross-language consistency, drag-and-drop reordering, DOCX export, and
admin-managed custom webfonts for Sinhala/Tamil scripts.

## Status

Early scaffold. See the phase breakdown below — each phase lands as its own
branch/PR in this repo.

- [x] Phase 0 — scaffold (manifest, package.json, tsconfig, starter page)
- [x] Phase 1 — isolated DB schema (projects, content_block_groups,
      content_blocks, project_members, custom_fonts)
- [x] Phase 2 — project CRUD + shell UI
- [ ] Phase 3 — Lexical editor + autosave
- [ ] Phase 4 — block groups + drag reorder
- [ ] Phase 5 — collaborators via `sdk.directory`
- [ ] Phase 6 — linting engine port
- [ ] Phase 7 — DOCX export
- [ ] Phase 8 — custom fonts via `sdk.storage`
- [ ] Phase 9 — monetization (paywall)
- [ ] Phase 10 — polish, tests, docs

## Documentation

- [SPEC.md](SPEC.md) — concept, problem statement, target users, high-level plan.
- [CLAUDE.md](CLAUDE.md) — architecture, data model, SDK usage rules,
  requirements, and the decision log behind them. Read this before making any
  implementation choice not already spelled out in the code.
- [roadmap.md](roadmap.md) — phase-by-phase task index.

## Developing this plugin

Currently developed in-tree, inside a local checkout of the Sovereign
monorepo, at `plugins/sovereign-tritext.local/` — the documented `.local`
suffix convention for a `type: "sovereign"` plugin that lives in its own
repository but is being tested against a local platform checkout before
publishing (see `docs/plugin-development.md` → "Developing a sovereign
plugin inside the platform monorepo"). That directory is covered by the
platform repo's own `.gitignore` and is a full pnpm workspace member, so
`pnpm dev` at the platform repo root serves it live at `/tritext` — no
separate install step. This repo (`sovereign-tritext`) is this plugin's own
source of truth; the platform repo never tracks it.

```bash
pnpm db:generate   # regenerate sqlite+postgres migrations after a schema.ts change
pnpm typecheck
```

Once ready to distribute standalone, other Sovereign instances install it via
their own `sovereign.plugins.json` + `pnpm install:plugins`, pointed at this
repo's real URL (update the placeholder `repository` field in
`manifest.json` first — required for `type: "sovereign"`).
