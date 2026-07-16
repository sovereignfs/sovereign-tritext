# Tritext

## Table of Contents

1. [Concept](#1-concept)
2. [Plan](#2-plan)

For architecture, data model, SDK usage rules, requirements, and the
decision log, see [CLAUDE.md](CLAUDE.md). For the phase-by-phase task index,
see [roadmap.md](roadmap.md).

---

## 1. Concept

### 1.1 Overview

Tritext is a trilingual (Sinhala / Tamil / English) content and translation
management app: projects containing collapsible block groups of content
blocks, each edited per-language in a rich-text editor, with collaborator
roles, cross-language consistency checks, and DOCX export.

### 1.2 Origin

Ported from an earlier prototype, "Tritext Content Hub" — a Lovable.dev/Vite/
Supabase SPA — onto the [Sovereign](https://github.com/sovereignfs/sovereign)
plugin platform. The prototype's actual feature set and data model are the
starting point; this is not a clean-slate design. See CLAUDE.md → "Ported
from the prototype" for exactly what carried over, what was dropped, and
what's deferred.

### 1.3 Problem Statement

Producing content in three languages side by side (a common requirement for
Sri Lankan government, civic, and NGO publishing) is normally coordinated
over documents and spreadsheets: there's no shared view of per-language
completion state, no structural check that a Tamil translation didn't drop a
paragraph the Sinhala source has, and no per-language permission model (a
Tamil translator shouldn't need edit access to the English column).

### 1.4 Solution

A single project view where each content block shows all enabled languages
side by side, each with its own status (draft/in review/approved) and its
own edit permission. A structure/semantic linting pass flags cross-language
drift automatically. Finished projects export to DOCX.

### 1.5 Target Users

Translation teams, civic/government content teams, and NGOs producing
multilingual publications — small teams (a handful of editors/translators per
project), not enterprise-scale localization pipelines.

### 1.6 Non-Goals (v1)

- Real-time collaborative editing / live presence (no backing platform
  primitive yet — see CLAUDE.md → "Ported from the prototype").
- Machine translation or AI-assisted translation suggestions.
- Public, unauthenticated share links.
- Generalized localization/i18n tooling (this is a project-based content
  tool, not a translation-management platform for software strings).

---

## 2. Plan

### 2.1 Distribution Model

`type: "sovereign"` plugin, repository `sovereign-tritext`, monetized
(one-time purchase) once Phase 9 lands. See CLAUDE.md → "Working
conventions" for how it's developed and distributed in practice.

### 2.2 Tech Stack

Next.js App Router (spliced into the host platform at build time) ·
`@sovereignfs/sdk` · `@sovereignfs/ui` · Drizzle ORM (isolated store) ·
Lexical (rich-text editor) · `@dnd-kit` (drag-and-drop) · `docx` (export) ·
Vitest + Testing Library.

### 2.3 Phased Roadmap

See [roadmap.md](roadmap.md) for the full phase-by-phase task index.
Summary: schema and CRUD shell first, then the editor, then collaboration
and consistency-checking features, then export/fonts, then monetization.

### 2.4 MVP Scope

Phases 0–4 (scaffold, schema, project/block CRUD, editor with autosave,
groups with reorder) constitute a usable single-user tool. Phases 5–8 add the
features that make it a real team tool (collaborators, linting, export,
fonts). Phase 9 turns on the paywall.
