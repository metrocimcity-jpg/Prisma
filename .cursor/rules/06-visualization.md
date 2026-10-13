# Visualization Rules

## Goal

Embed **Carrot Search FoamTree** (`@carrotsearch/foamtree`) as the visualization engine.

Do not reimplement FoamTree layout, relaxation, or polygon rendering. Prisma adapts the file index into FoamTree `dataObject` groups and maps typed config onto FoamTree options.

Reference:

- Official package and [API](https://get.carrotsearch.com/foamtree/latest/api/)
- [Settings demo](https://get.carrotsearch.com/foamtree/latest/demos/settings.html) for defaults and tunable options
- `context/file-treemap-explorer.html` for the Disk Prisma look (preset, not default)

## Branding strip

The npm package is a branded demo build that injects an attribution cell. Prisma removes it with the Vite plugin in `vite.foamtree-branding.ts` (and keeps `@carrotsearch/foamtree` in `optimizeDeps.exclude` so the transform applies). Do not reintroduce the logo via CSS hacks that leave a dead cell; keep the injection strip.

## Adapter Layer

Keep FoamTree behind a thin adapter:

```text
src/visualization/foamtree/
  dataObject.ts      VizNode -> FoamTree groups
  options.ts         VisualizationConfig -> FoamTree options
  settingsSchema.ts  Settings panel controls
  stylePresets.ts    Color / style / layout / animation presets
  host.ts            Active instance helpers
```

## Layout Modes

Prisma layout modes map to FoamTree:

| Prisma layout | FoamTree |
| --- | --- |
| `foam` | `layout: relaxed`, `stacking: hierarchical` |
| `treemap` | `layout: squarified` |
| `circles` | `relaxed` + `relaxationInitializer: fisheye` |
| `sunburst` | `relaxed` + `stacking: flattened` |

Prefer driving layout from `VisualizationStyle` fields (`foamLayout`, `stacking`, `relaxationInitializer`) and keep Prisma `layout` in sync.

Command palette may switch `visualization.renderer` among FoamTree and experimental D3 views; treat FoamTree as the default ship path.

## Color Models

Support two color models in style config:

- **`rainbow`** (default) — FoamTree built-in rainbow. Do not override with a custom group color decorator unless necessary.
- **`prisma`** — Disk Prisma extension / category coloring; folders use a neutral fill; files get palette colors. Use `groupColorDecorator` only in this mode.

## Dimensions

Users must be able to choose:

### Size By

- file size, file count, folder size, equal, age, custom property

### Color By

- extension, file type, category, MIME type, folder, file size, modified date, created date, age, attributes, custom property

### Group By

- folder, extension, file type, category, subcategory, MIME type, date, size, owner, drive, path, custom property
- ACC taxonomy levels when present: portfolio, program, subprogram, originator, location, discipline, document type (full names, not abbreviations)

## Multi-Level Grouping

Support configurations such as:

```text
Category
  -> File Type
    -> Extension
```

Sidebar **View** hosts Group by + Multi-Level Hierarchy (`HierarchyList`).

## Interaction

Hover: highlight, title bar / tooltip, emphasize cluster.

Click: select file or group.

Double click: drill / open; prevent default for leaf files when opening via app.

Escape: clear selection / reset view / navigate up (also closes Analysis / Preview / Settings overlays first).

Wheel: zoom (`zoomMouseWheelFactor`). Drag: pan / expose / open (FoamTree built-ins).

## Level of Detail

Respect FoamTree options (`maxGroupLevelsDrawn`, label font size limits). Do not invent a second LOD system that fights FoamTree.

## Defaults

Factory defaults come from FoamTree (`foamtreeDefaultStyle()`):

- gradient fills, hierarchical stacking, rainbow colors
- Oxygen font family (demo default)
- ~2s rollout / 1.5s pullback

Disk Prisma (`diskPrismaStyle()`) is a preset, not the factory default.

## Analysis vs Visualization

Analysis charts replace the FoamTree stage while open; they use the same focused scope as the treemap. Closing Analysis restores FoamTree. Do not fork a separate data pipeline for charts — derive from `vizTree` / index items in scope.
