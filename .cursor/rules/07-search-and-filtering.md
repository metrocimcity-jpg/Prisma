# Search and Filtering Rules

## Classic search

Search must support:

- filename
- folder name
- extension
- full path
- category
- file type
- metadata

Use an indexed search approach for large datasets.

Support fuzzy matching.

Debounce interactive search.

## Query Syntax

Prefer support for:

```text
ext:dwg
type:CAD
category:BIM
size:>100MB
size:<1GB
modified:>2026-01-01
created:<2025-01-01
name:bridge
path:project
```

Support AND/OR where practical.

## Ask Prisma (semantic)

Natural language over the **loaded JSON index** (not a live disk crawl).

Capabilities agents must preserve:

- Counts / recency: `3 newer revit`, `top five pdfs`, word counts (`three`)
- Dates: today, yesterday, last/this week|month|year, `last 2 weeks`, `two weeks ago`, word amounts
- Multi-ask: join with `/` `|` `;` or newlines; UI chips toggle parts
- Metadata: sample `discipline` and ACC fields from indexes like `AE.index.json` (`ACC-Discipline`, `ACC-Location`, `ACC-Document Type`, portfolio/program/subprogram/originator); explicit `key=value`
- Map: pin hits as **adjacent FoamTree siblings**; Esc / Backspace / `clearAsk` / voice Back restore prior view snapshot
- Empty asks: return unrelated **sample** hits with `usedFallback` rather than an empty map
- Voice: ask/find/show-me routes; Ask box mic dictation
- API: `ask`, `askMany`, `previewAsk`, `parseAsk`, `splitAsk`, `getAsk`, `listAskHits`, `clearAsk`, `pinAskHits` on `window.prisma`

Modules: `src/search/semanticIntent.ts`, `semanticMetadata.ts`, `semanticSearch.ts`, `src/api/prismaApi.ts`, `src/ui/layout/SemanticSearchBox.tsx`.

Manual for humans/agents: `docs/readme/semantic-search-and-api.md`.

Do not apply classic keyword `search` as an AND filter when pinning Ask hits — Ask owns the temporary viz tree.

## Filters

Provide:

- extension
- file type
- category
- size
- created date
- modified date
- accessed date
- hidden
- system
- read-only
- executable
- symbolic link
- has metadata
- duplicate
- recently modified
- old files
- empty folders

## Filter Engine

Filtering logic should be testable independently of React/UI.

Filters should be composable.

## UX

Show:

```text
Showing 12,483 of 52,901 items
```

Provide:

- Clear All
- saved filter presets
- active-filter chips
- counts where practical

Filtering must update the visualization efficiently.
