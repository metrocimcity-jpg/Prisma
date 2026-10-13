# Project Overview

## Mission

Build a production-quality visual filesystem explorer powered by **Carrot Search FoamTree** (`@carrotsearch/foamtree`).

Use the official FoamTree package for layout and rendering. Do not reimplement Voronoi layout, relaxation, or FoamTree drawing in custom canvas code.

Current product line: **Prisma 0.4.x**.

## Capabilities

The application must:

- Scan a user-selected folder recursively (with progress and non-fatal errors).
- Extract available filesystem and file-specific metadata.
- Export a versioned JSON index; load/merge JSON without rescanning.
- **Merge folder** / **Merge JSON** for multi-batch ACC or local trees.
- Visualize folders/files with FoamTree (relaxed / squarified / flattened stacking).
- Support search, filtering, grouping (including ACC taxonomy levels), coloring, sizing, drill-down, and details.
- Provide a FoamTree **Settings** panel with color and style presets.
- Provide **Analysis** charts for the focused / open folder scope (bubble + line).
- Provide **Preview** for selected PDF, IFC (3D), image, video, audio, and text files.
- Support SharePoint browse (when configured) and **Resolve ACC links**.
- Keep the FoamTree stage free of the demo attribution cell (Vite branding strip).
- Remain performant on large datasets.

## Product Principle

The application is not merely a colorful file manager. It is a visual filesystem analytics and exploration tool.

## Default Look vs Disk Prisma

- **Default appearance** matches the official FoamTree factory settings from the [FoamTree settings demo](https://get.carrotsearch.com/foamtree/latest/demos/settings.html): rainbow color model, gradient fills, hierarchical stacking, Oxygen labels, light stage.
- **Disk Prisma** (from `context/file-treemap-explorer.html`) is preserved as an **Appearance / color / style preset**: gold/teal chrome cues, flattened stacking, plain fills, Inter labels, extension-based file coloring.

## Primary Workflow

1. Select folder (or load sample / Open JSON).
2. Scan recursively with progress (or merge additional batches).
3. Generate / export `<root>.index.json`.
4. Visualize indexed data with FoamTree.
5. Use sidebar rail sections: Search+Filters, View, Overview, File Identity (one at a time).
6. Search / filter / group / color / size; apply ACC group-by when taxonomy is present.
7. Open **Analysis** for folder-scoped charts; **Preview** for the selected file.
8. Tune FoamTree options in Settings; apply style / analysis presets (More closes after pick).
9. Save visualization / workspace configuration.
10. Later load or merge JSON without rescanning.

## Priority Order

1. Correctness
2. Performance
3. Maintainability
4. Extensibility
5. UX
6. Visual polish

## Development Rule

Always inspect the existing repository before changing architecture. Reuse working code when practical. Do not rewrite the project unnecessarily.

When restyling FoamTree or Settings, prefer matching official FoamTree options and the Disk Prisma reference HTML rather than inventing a parallel visual system.

Keep `README.md`, `CHANGELOG.md`, and `.cursor/rules/` aligned when capabilities change.
