# Architecture Rules

## General

Use a modular architecture. Do not create a giant `App` component, giant scanner file, or monolithic utility module.

Recommended separation:

```text
scanner/
data/
metadata/          classification, ACC taxonomy
sharepoint/        auth, Graph, drive import
visualization/
  foamtree/        FoamTree adapter, options, settings schema, style presets, host
filtering/
search/            field SearchEngine + semanticIntent / semanticMetadata / semanticSearch
api/               window.prisma (ask, askMany, parseAsk, clearAsk, map, filters, …)
voice/             spoken commands including Ask Prisma
ui/
  layout/          Sidebar rail, Analysis, Preview (PDF/IFC/media), Toolbar, StatusBar
  dialogs/         Settings, command palette, SharePoint browser, scan progress
  visualization/   FoamCanvas, VizStage, breadcrumbs
config/
state/
utils/             previewKind, pdf, ifc, ACC / web links
```

Root Vite helper: `vite.foamtree-branding.ts` (strips demo attribution; keep FoamTree excluded from `optimizeDeps` prebundle).

## Responsibilities

### Scanner

Filesystem traversal and metadata extraction only.

### Data

Schema, normalization, indexing, aggregation, serialization/deserialization, merge of batches.

### Visualization

Hierarchy transformation (grouping), color/size mappers, and the FoamTree adapter.

Rendering of cells is FoamTree’s job. Prisma only:

- builds `dataObject` groups
- maps config → FoamTree options
- hosts the FoamTree instance in the UI

### Filtering / Search / Ask Prisma

Pure filter definitions and execution; classic field search; natural-language Ask Prisma (`semanticIntent`, index/ACC `semanticMetadata`, `semanticSearch` multi-ask + fallback). `api/prismaApi.ts` exposes `window.prisma` including ask helpers. Ask pins use store `semanticHitIds` and a temporary FoamTree sibling layout.

### UI

Shell, top bar, crumb bar, **sidebar rail + exclusive section panels**, FoamTree / Analysis stage, Preview and Settings side panels, dialogs.

### Preview / Analysis

- Preview stages live under `ui/layout` (`PdfStage`, `IfcStage`, `MediaStage`) and are selected via `utils/previewKind`.
- Analysis charts (`AnalysisBubbleChart`, `AnalysisLineChart`) operate on the focused viz scope, not a second index.

### Config

Application defaults, analysis presets, FoamTree style presets, saved workspace state, SharePoint settings.

## Dependency Direction

Prefer:

```text
UI -> application state/services -> domain/data
Visualization/foamtree -> domain/data + typed VisualizationConfig
Preview utils -> selected FileNode + File System Access / blob URLs
Scanner -> filesystem + metadata providers
SharePoint -> Graph + data index builders
Search / Filtering -> normalized data
```

Avoid circular dependencies.

## Interfaces

Use interfaces for replaceable systems:

- `FileScanner`
- `MetadataProvider`
- `FileClassifier`
- `SearchEngine`
- `FilterEngine`
- `ColorMapper`
- `SizeMapper`
- `GroupingStrategy`

FoamTree itself is the layout/renderer. Keep a thin adapter rather than a second custom layout engine for the main view. Alternate renderers (circle packing / sunburst) may exist behind `visualization.renderer` but FoamTree remains the primary product path.

## Configuration

Do not hard-code user-tunable FoamTree values in components.

Use typed configuration objects and centralized defaults (`foamtreeDefaultStyle`, `diskPrismaStyle`).

## Extensibility

New file types, metadata providers, grouping strategies, color mappings, preview kinds, and FoamTree style presets should be addable without modifying unrelated subsystems.

## Reference Assets

- `context/file-treemap-explorer.html` — Disk Prisma UI + FoamTree flattened style reference
- FoamTree settings demo — factory defaults and settings-panel UX reference
