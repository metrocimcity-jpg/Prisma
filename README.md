# Prisma

Visual filesystem analytics explorer. Scan a folder (or load a versioned JSON index) and inspect it with **Carrot Search FoamTree** — the official Voronoi treemap engine — plus search, filters, grouping, coloring, Analysis charts, file Preview, and a FoamTree settings panel.

Current product version: **0.4.0**.

The visualization uses the `@carrotsearch/foamtree` package (demo distribution). Prisma adapts the file index into FoamTree groups; it does not reimplement FoamTree’s layout. A Vite transform (`vite.foamtree-branding.ts`) strips the demo attribution cell so the stage stays clean.

## Capabilities (0.4)

| Area | What it does |
| --- | --- |
| **Scan / index** | Recursive folder scan, progress, versioned `.index.json`, sample Harbor-Bridge fixture |
| **Merge** | Merge folder or Merge JSON into the open map (multi-batch ACC / local trees) |
| **FoamTree** | Group / color / size / stack; factory defaults or Disk Prisma preset; live Settings |
| **Search & filters** | Query + extension / size / date filters in the Search sidebar section |
| **ACC** | Taxonomy group-by labels, Resolve ACC links, SharePoint browse (when configured) |
| **Analysis** | Folder-scoped bubble chart (age / subprogram / size) and line chart |
| **Preview** | PDF, IFC (3D), image, video, audio, text for the selected file |
| **Export** | JSON index, CSV, workspace view state |

## Default look vs Disk Prisma

| Mode | Meaning |
| --- | --- |
| **Default** | FoamTree factory styling from the [settings demo](https://get.carrotsearch.com/foamtree/latest/demos/settings.html): rainbow colors, gradient fills, hierarchical stacking, Oxygen labels, light stage |
| **Disk Prisma preset** | Previous Prisma chrome/style from `context/file-treemap-explorer.html`: flattened stacking, plain fills, Inter labels, extension-based file coloring, dark stage |

Apply **Disk Prisma** from Settings → Presets → Appearance (or the Disk Prisma analysis preset under More).

## Architecture

```text
src/
  scanner/         filesystem traversal
  data/            schema, aggregation, JSON index
  metadata/        classification, ACC taxonomy, metadata providers
  sharepoint/      Graph auth + drive import
  visualization/   grouping, color/size mappers, FoamTree adapter
    foamtree/      dataObject, options, settingsSchema, stylePresets, host
  filtering/       composable filters
  search/          query parser + fuzzy search
  config/          defaults, analysis presets, workspaces
  ui/              shell, sidebar rail, Analysis, Preview, Settings, dialogs
  utils/           previewKind, pdf, ifc, ACC / web links
```

The JSON index is a first-class artifact. Visualization never requires a live rescan.

## Prerequisites

- Node.js 20+
- Chrome or Edge for folder scanning (File System Access API)

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

Open the printed local URL. Then:

1. **Load folder** — recursive scan with progress; export as `<root>.index.json`.
2. **Merge folder** — add another ACC or local batch into the current map.
3. **Open JSON** / **Merge JSON** (More) — load or merge a previously exported index.
4. **Sample data** — Harbor-Bridge fixture for UI review without a local tree.
5. **Analysis** — charts for the open / focused folder scope.
6. **Preview** — inspect the selected PDF, IFC, or media file.
7. **Settings** — FoamTree options, color/style presets, export settings JSON.

## Build

```bash
npm run build
npm run preview
```

## Scanning

- Permission errors and locked files are recorded in `errors` and do not abort the scan.
- Cryptographic hashing is not performed.
- Browser scans cannot observe created/accessed times, NTFS attributes, or symlink identity; those fields stay `null` rather than guessed.
- Specialized metadata (for example image pixel size) is only stored when a provider actually extracts it.

## JSON index

Schema version `1.0`. Shape:

```json
{
  "schemaVersion": "1.0",
  "generatedAt": "",
  "generatorVersion": "0.1.0",
  "root": { "id": "/", "name": "", "path": "" },
  "statistics": {},
  "items": [],
  "errors": []
}
```

Load this file later with **Open JSON**. Workspaces (`prisma.workspace.json`) store view state only — not a second copy of file metadata.

## UI layout

```text
Top bar → crumb bar → [ sidebar rail + one section | FoamTree / Analysis | Preview | Settings ] → status bar
```

### Top bar

Sample data · Load folder · Merge folder · Analysis · Preview · Settings · More

**More** closes after any submenu action (Open/Merge JSON, SharePoint, ACC links, exports, presets, theme, commands).

### Left sidebar

Icon rail is always available. Each icon shows **only** its panel:

| Icon | Panel |
| --- | --- |
| Search | Search box + Filters |
| View | Group by, hierarchy, color by, display stacking |
| Overview | Scope totals and top types |
| File Identity | Selection details |

## Configuration

- **View panel:** Group By (including ACC taxonomy levels), Color By, Multi-Level Hierarchy, Display (flattened / hierarchical)
- **Settings panel:** FoamTree options with live updates; Presets (Appearance, Color, Borders & fill, Layout, Animation); export settings JSON
- **Analysis presets (More):** Disk Prisma, BIM, CAD, Large Files, Recently Modified, Engineering, Archive

## Search

Examples:

```text
bridge
ext:dwg
category:BIM
size:>100MB
modified:>2026-01-01
name:harbor AND path:BIM
```

## Keyboard

| Shortcut | Action |
| --- | --- |
| Ctrl+O | Open folder |
| Ctrl+Shift+O | Open JSON |
| Ctrl+F | Focus search (opens sidebar if hidden) |
| Ctrl+K | Command palette |
| Ctrl+R | Rescan / open folder |
| Esc | Close overlay / clear selection / navigate up |
| Backspace | Navigate back |
| Enter | Open selected file |

## Tests

```bash
npm test
npm run typecheck
```

## Agent docs

Cursor implementation prompts live in `.cursor/rules/` (overview, architecture, visualization, UI, workflow, commands, acceptance). Keep them in sync when capabilities change — see `18-git-and-documentation.md`.

## Troubleshooting

- **Open folder disabled / error** — use Chromium (Chrome, Edge, or a Chromium-based Electron shell). Firefox does not implement `showDirectoryPicker`.
- **Malformed JSON** — Prisma reports validation errors and does not crash.
- **Empty visualization after filters** — clear all filters or widen the query; the status bar shows matching counts.
- **Want the old Disk Prisma look** — Settings → Presets → Appearance → Disk Prisma.
- **FoamTree logo still visible** — hard-refresh; branding strip runs via Vite on `@carrotsearch/foamtree`.
