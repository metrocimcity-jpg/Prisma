# Acceptance Criteria

The implementation is acceptable only when this end-to-end workflow works for **Prisma 0.4**.

## Scan

User selects a folder.

The application:

1. recursively scans it;
2. displays progress;
3. handles errors without crashing;
4. creates a versioned JSON index;
5. displays aggregated statistics.

## Load / Merge

User opens an existing JSON index, sample data, or merges another folder/JSON.

The application:

1. validates schema (for JSON);
2. loads or merges the data;
3. reconstructs hierarchy;
4. renders visualization with **official FoamTree**;
5. does not rescan the filesystem when loading JSON.

## Visualization

The default visualization uses FoamTree factory styling and supports:

- hierarchical and flattened stacking
- proportional sizing
- rainbow and Prisma (`prisma`) color models
- drill-down / expose / open
- zoom
- selection
- labels / title bar
- live option updates from the Settings panel
- no demo FoamTree attribution watermark on the stage

**Disk Prisma** must remain available as an Appearance preset.

## Sidebar

Each rail icon reveals **only** its section (Search+Filters, View, Overview, File Identity). Switching icons must not leave other sections stacked in the same scroll view.

## Search / Filters

Search works for filenames and paths at minimum (fuzzy preferred).

Filters at minimum: extension, type / category, size, modified date.

## Dynamic Visualization

Changing Group By, Color By, Size By, Stacking / Layout, Style presets, and ACC group-by (when taxonomy present) must visibly change the visualization.

## Analysis

Opening Analysis shows folder-scoped charts with empty states when data is insufficient. Closing restores FoamTree.

## Preview

Selecting a previewable file can show PDF / IFC / media / text preview. Closing Preview leaves the map intact.

## Details / Overview

Selecting an item shows metadata. Folders / groups show aggregated statistics in Overview and details.

## More menu

Choosing any More submenu item runs the action and **closes** the More popover.

## Appearance

Dark chrome theme works. FoamTree settings panel works with search, foldable sections, presets, and JSON export. Visualization tuning updates live.

## Export / ACC / SharePoint

JSON and CSV export work. Workspace export stores view state without duplicating the full index.

Resolve ACC links and SharePoint browse behave safely when not configured (clear error, no crash).

## Reliability

Malformed JSON, inaccessible files, and missing metadata must not crash the application.
