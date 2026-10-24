# Ask Prisma — semantic search & API manual

Natural-language search over a loaded JSON index (sample Harbor-Bridge, scanned folders, or ACC exports such as `AE.index.json`). Matching files are pinned on a **temporary FoamTree** as adjacent sibling cells. Esc / Backspace (or voice **Back**) restores the previous map.

## Where to use it

| Surface | How |
| --- | --- |
| **Search sidebar → Ask Prisma** | Type an ask, use chips, mic / Speak to map, or **Show on map** |
| **Voice** | With Voice on: **ask …**, **find …**, **show me …**, or a full ask sentence |
| **Chrome console / scripts** | `window.prisma.ask(…)`, `askMany`, `previewAsk`, … |

## Phrase cookbook

### Counts & recency

```text
3 newer revit
three newer revit models
top five pdfs
```

### Dates (named + numbers + words)

```text
today / yesterday
last week / this week
last month / this month
last year / this year
last 2 weeks
past three months
within ten days
two weeks ago dwg
a month ago pdf
```

### Types & multi-ask

```text
last month pdfs
two weeks ago dwg
3 newer revit / last month pdfs / two weeks ago dwg
```

Join asks with `/`, `|`, or `;` (or newlines). Chips toggle the same multi-search.

### JSON / ACC metadata

Hard filters against file `metadata` (sample `discipline`, and all ACC fields from `AE.index.json`):

```text
Architectural revit models
electrical revit models
drawings runway 05
ACC-Discipline=ELE7
discipline=ARCH
ACC-Location=ARW05
M3D ARW05
```

Recognized ACC keys include:

- `ACC-Portfolio`, `ACC-Program`, `ACC-Sub Program`, `ACC-Originator`
- `ACC-Location`, `ACC-Discipline`, `ACC-Document Type`

Codes (`ELE7`, `ARW05`, `M3D`, `DRG`) and spoken synonyms (electrical, drawings, runway, …) are matched against the loaded index catalog.

### Empty asks

If nothing matches strongly, Prisma still pins a few **sample (unrelated) files** and labels the result as a fallback so the map is never blank.

## Map behavior

1. Ask runs → hits become root siblings on FoamTree (not nested under Harbor-Bridge → BIM → …).
2. Esc / Backspace / `prisma.clearAsk()` / voice **Back** restores search, filters, focus, and selection from before the ask.
3. Voice **Reset** clears the ask and resets the view.

## `window.prisma` — semantic API

After the app loads in Chrome:

```js
prisma.loadSample()

// Rank + pin on the map (supports multi-ask with "/")
prisma.ask("all revit models for airfield location for last month")
prisma.ask("3 newer revit / last month pdfs")
prisma.askMany(["electrical revit models", "drawings runway 05"])

// Inspect without changing the map
prisma.previewAsk("last month pdfs")
prisma.parseAsk("Architectural revit models")
prisma.splitAsk("a / b / c")

// Current pin
prisma.getAsk()          // { ask, hitIds, hits }
prisma.listAskHits()
prisma.getFavorite("3 newer revit")

// Clear / pin manually
prisma.clearAsk()
prisma.pinAskHits("custom", [prisma.findFile("Airfield-Terminal.rvt").id])
```

### Semantic methods

| Method | Effect |
| --- | --- |
| `ask(text)` | Multi-capable NL search; pins hits on FoamTree; returns `{ hits, favorite, intent, appliedSearch, parts, usedFallback }` |
| `askMany(parts)` | Same as `ask(parts.join(" / "))` |
| `previewAsk(text)` | Same ranking as `ask`, no map change |
| `parseAsk(text)` | Structured intent (extensions, dates, limit, metadata filters, …), enriched from the loaded index |
| `splitAsk(text)` | Split on `/` `\|` `;` / newlines |
| `getFavorite(text)` | Top file node or `null` |
| `getAsk()` | Current ask string + pinned ids/nodes |
| `listAskHits()` | Pinned file nodes |
| `clearAsk()` | Leave Ask mode; restore prior map |
| `pinAskHits(ask, hitIds)` | Pin arbitrary ids as Ask results |

### Related map / search methods

| Method | Effect |
| --- | --- |
| `search(query)` | Classic field search (`ext:rvt`, …) |
| `clearSearch()` | Clear classic search (also clears Ask pin) |
| `back()` | Restores prior map when an Ask is active |
| `reset()` | Clears Ask then resets FoamTree |
| `getSelected()`, `listVisible()`, `findFile(name)` | Selection / lookup |

Full chrome API (filters, panels, camera, voice, load/export) remains on `window.prisma` — see the main [README](../../README.md#windowprisma-api).

## Voice examples

```text
ask all revit models for airfield location for last month
find three newer revit models
show me last month pdfs
electrical revit models
```

Mic / **Speak to map** on the Ask box dictate into the field (and optionally run the ask). That pauses command Voice while dictating.

## Files (for agents)

| Path | Role |
| --- | --- |
| `src/search/semanticIntent.ts` | NL → intent |
| `src/search/semanticMetadata.ts` | Index/ACC metadata catalog + enrichment |
| `src/search/semanticSearch.ts` | Rank, multi-ask, fallback samples |
| `src/api/prismaApi.ts` | `window.prisma` bridge |
| `src/ui/layout/SemanticSearchBox.tsx` | Ask UI (chips, mic, multi) |
| `src/voice/parseVoiceUtterance.ts` | Spoken ask routing |
| `src/state/store.ts` | `semanticHitIds` / snapshot restore |
