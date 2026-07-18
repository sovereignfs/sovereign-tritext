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

Feature-complete and monetized. See the phase breakdown below — each phase
landed as its own branch/PR in this repo.

- [x] Phase 0 — scaffold (manifest, package.json, tsconfig, starter page)
- [x] Phase 1 — isolated DB schema (projects, content_block_groups,
      content_blocks, project_members, custom_fonts)
- [x] Phase 2 — project CRUD + shell UI
- [x] Phase 3 — Lexical editor + autosave
- [x] Phase 4 — block groups + drag reorder
- [x] Phase 5 — collaborators via `sdk.directory`
- [x] Phase 6 — linting engine port
- [x] Phase 7 — DOCX export
- [x] Phase 8 — custom fonts via `sdk.storage`
- [x] Phase 9 — monetization (paywall)
- [x] Phase 10 — polish, tests, docs

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

## Self-hosting Tritext on your own Sovereign instance

Tritext is a `type: "sovereign"` plugin distributed as its own git
repository, not something bundled with the platform. To install it on a
self-hosted Sovereign instance:

1. Add an entry pointing at this repo to your instance's
   `sovereign.plugins.json` (see the platform repo's
   [`docs/self-hosting.md`](https://github.com/sovereignfs/sovereign/blob/main/docs/self-hosting.md)
   for the file's exact shape).
2. Run `pnpm install:plugins` at the platform root — this clones the repo
   into `plugins/`, matching the manifest's declared `id`
   (`com.mooniak.tritext`).
3. Rebuild/restart the platform (`pnpm build` in production, or restart
   `pnpm dev` locally) so the plugin is composed into the runtime and
   `/tritext` is served.
4. Grant the instance's users access to the app from the platform's admin
   console (Console plugin → Apps), same as any other installed plugin.

### License activation

Tritext is monetized as a **one-time purchase** (RFC 0003 in the platform
repo — see [CLAUDE.md → Monetization](CLAUDE.md#monetization)). After
installing, `/tritext` shows a paywall until a valid license token is
activated:

1. Purchase a license from the plugin author (contact info in this repo's
   listing — Tritext has no in-app payment flow; RFC 0003 plugins are
   licensed out-of-band).
2. On the paywall page, paste the license token you received into the
   "Activate license" field and submit.
3. The platform verifies the token's signature offline against the public
   key declared in `manifest.json` — no network call to any Tritext or
   Sovereign server is made. Once verified, `/tritext` is unlocked for that
   instance.

No plugin-side configuration is required for licensing; it's entirely
enforced by the platform reading `manifest.json`'s `monetization` block.

### Requirements

- A Sovereign platform instance already running (see the platform repo's
  own `docs/self-hosting.md` for that setup — Docker Compose, env vars,
  database).
- No additional environment variables or external services — Tritext uses
  only `sdk.db` (isolated store, auto-provisioned on install),
  `sdk.storage` (custom fonts), `sdk.directory` (collaborator lookup), and
  `sdk.notifications` (collaborator-added notices), all already provided by
  the host platform.
