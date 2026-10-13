# UI / UX Rules

## Product Feel

The application should feel like a premium filesystem analytics tool with FoamTree settings, Analysis, and Preview as first-class work surfaces.

Avoid generic Bootstrap-dashboard aesthetics.

Target qualities: modern, technical, minimal, professional, high information density, polished, calm, responsive.

## Main Layout

```text
Top bar (Prisma brand, Sample, Load, Merge, Analysis, Preview, Settings, More)
------------------------------------------------
Breadcrumb bar (⌂ all files › …)
------------------------------------------------
Sidebar rail + one section | FoamTree stage ‑or‑ Analysis | Preview | Settings
------------------------------------------------
Status bar
```

Overlays: command palette, SharePoint browser, scan progress.

## Left Sidebar (rail)

The icon rail stays visible when expanded. **Each icon shows only its panel** — never dump all cards into one scroll stack.

| Icon | Section | Content |
| --- | --- | --- |
| Search | `search` | Search field + Filters (`FilterPanel`) |
| View | `view` | Group by, hierarchy, color by, display stacking |
| Overview | `overview` | Scope file/size stats, top types |
| File Identity | `selection` | `DetailsPanel` for selection |

Collapsed mode: rail only. Expanding via an icon reveals that section. Switching icons swaps content without scrolling other sections into view.

## Top Bar

Include:

- Brand: **Prisma** + short tagline
- Sample data
- Load folder (primary)
- Merge folder
- Analysis (toggles analysis stage)
- Preview (toggles preview panel)
- Settings (toggles FoamTree settings panel)
- **More** menu: Open/Merge JSON, SharePoint, Resolve ACC links, Export JSON/CSV, Save workspace, analysis presets, theme, toggle sidebar, Commands

After any More submenu action, **close the More menu** (details element). Do not leave the popover open.

## Settings Panel

Model on the official [FoamTree settings demo](https://get.carrotsearch.com/foamtree/latest/demos/settings.html):

- search box for option names
- foldable sections
- live controls
- Presets (Appearance, Color scheme, Borders & fill, Layout, Animation)
- Export settings to JSON

Default visualization style is FoamTree factory. **Disk Prisma** remains an Appearance preset.

## Analysis

Analysis occupies the main stage (not a tiny overlay). Charts are folder-scoped:

- Age and subprogram (bubble / scatter)
- Line chart by subprogram / time / file count

Provide clear empty states when taxonomy or dates are missing.

## Preview

Preview sits as a side panel. Supported kinds (`previewKind`):

- `pdf` — PDF.js stage
- `ifc` — web-ifc + Three.js stage
- `image` / `video` / `audio` / `text` — media stage

Selecting a previewable file may auto-open Preview and close Settings when appropriate.

## Details

Selected files show useful metadata. Selected folders / groups show aggregated statistics (also reflected in Overview).

## Breadcrumbs

Always make current hierarchy understandable (`⌂ all files` with `›` separators).

## Keyboard

```text
Ctrl+O       Open Folder
Ctrl+Shift+O Open JSON
Ctrl+F       Search (ensure sidebar visible, focus Search section)
Ctrl+K       Command Palette
Ctrl+R       Rescan / Open Folder
Esc          Close overlays → clear selection → navigate up
Backspace    Back
Enter        Open selected
```

## Accessibility

Keyboard navigation, visible focus, readable contrast, reduced motion, semantic controls.
