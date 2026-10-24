# Changelog

## 0.4.0

- Ask Prisma: natural-language search over the loaded JSON index — counts/recency (`3 newer revit`), named dates (`last month`, `two weeks ago`), multi-ask with `/`, JSON/ACC metadata (`Architectural revit`, `ACC-Discipline=ELE7`), voice ask + mic dictation, temporary FoamTree pin with Esc/Backspace restore, and sample files when nothing matches.
- `window.prisma` semantic API: `ask`, `askMany`, `previewAsk`, `parseAsk`, `splitAsk`, `getAsk`, `listAskHits`, `clearAsk`, `pinAskHits`, plus map/filters/panels/load/export/camera/voice.
- Manual: [`docs/readme/semantic-search-and-api.md`](docs/readme/semantic-search-and-api.md).
- `window.prisma` API for the original app: click/open cells, back/reset/zoom, category and extension filters, search/ask, panels, load/export, camera, and voice.
- Camera hand gestures on the FoamTree stage: point to move, pinch to select, double pinch to open a cell, thumbs to zoom, open palm to go back, fist to reset, victory to open the file under the cursor.
- Voice commands start when **Voice** is on and pause on **Prisma down**. While on: open a cell by name (same as a double-click), select every cell, back, reset, and filter. **Prisma** resumes them.
- Analysis panel: folder-scoped bubble (age / subprogram / size) and line charts.
- Preview panel: PDF (`pdfjs-dist`), IFC (`web-ifc` + Three.js), and media/text stages for selected files.
- Left sidebar rail shows **one panel per icon** (Search+Filters, View, Overview, File Identity); More menu closes after a submenu choice.
- Merge folder / Merge JSON for multi-batch indexes; SharePoint browse + ACC link resolve / ACC taxonomy group-by labels.
- Vite transform strips FoamTree demo attribution watermark (`vite.foamtree-branding.ts`).
- Explorer sidebar chrome restyle into a single signature panel.

## 0.3.0

- Default FoamTree look matches the official factory / [settings demo](https://get.carrotsearch.com/foamtree/latest/demos/settings.html) (rainbow, gradients, hierarchical stacking).
- Disk Prisma UI and flattened extension coloring preserved as an Appearance / analysis preset (`context/file-treemap-explorer.html`).
- Settings panel modeled on FoamTree settings: search, foldable sections, color/style/layout/animation presets, export settings JSON.
- Color models: `rainbow` (default) and `prisma` (file-type decorator).
- Chrome layout: top bar, crumb bar, left sidebar cards, full-bleed stage, right settings panel, status bar.

## 0.2.0

- Visualization embeds Carrot Search FoamTree (`@carrotsearch/foamtree`) instead of a custom canvas foam.
- Layout modes map to FoamTree relaxed, squarified, fisheye, and flattened stacking.

## 0.1.0

- Initial Prisma explorer: recursive folder scan, versioned JSON index, CSV export.
- Foam / treemap / circle / sunburst layouts with group, color, and size mapping.
- Search (including field syntax), composable filters, presets, and workspaces.
- Dark/light themes and live visualization tuning.
