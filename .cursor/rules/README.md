# Cursor Rules Index

Read these rules before implementing features. They describe the **0.4.x** product: FoamTree explorer, Analysis, Preview, ACC/SharePoint, and sidebar rail UX.

- `00-project-overview.md` — mission, capabilities, primary workflow
- `01-architecture.md` — modular layout (foamtree, preview, sharepoint, analysis)
- `02-revit-cad-bim-domain.md` — engineering/BIM/CAD classifications
- `03-data-schema.md` — JSON index and data model
- `04-scanner.md` — filesystem scanning
- `05-metadata-and-classification.md` — metadata providers, ACC taxonomy
- `06-visualization.md` — FoamTree adapter, layouts, color models, branding strip
- `07-search-and-filtering.md` — search and filters
- `08-ui-ux.md` — chrome, sidebar rail (one panel per icon), Analysis, Preview, More menu
- `09-design-system.md` — tokens, palettes, FoamTree style model
- `10-performance.md` — large dataset performance
- `11-security.md` — filesystem and JSON security
- `12-testing.md` — test requirements
- `13-cursor-workflow.md` — Cursor implementation workflow
- `14-code-style.md` — coding standards
- `15-config-and-presets.md` — style presets, analysis presets, workspaces
- `16-acceptance-criteria.md` — definition of done for 0.4 capabilities
- `17-commands-and-shortcuts.md` — command palette and keyboard map
- `18-git-and-documentation.md` — repository and doc sync practices

## Product decisions (keep in sync)

1. Visualization engine is `@carrotsearch/foamtree` (not a custom canvas FoamTree clone).
2. Default look = FoamTree factory / settings-demo defaults.
3. Disk Prisma look = Appearance preset (`diskPrismaStyle`), reference `context/file-treemap-explorer.html`.
4. Settings panel mirrors the official FoamTree settings demo (search, sections, presets, export JSON).
5. Demo FoamTree attribution is stripped at build/serve time via `vite.foamtree-branding.ts`.
6. Left sidebar rail shows **one section at a time**; More menu closes after a submenu choice.
7. Analysis and Preview are first-class stage/side panels (not buried only in Settings).
8. Merge folder/JSON, ACC taxonomy group-by, SharePoint browse, and ACC link resolve are supported workflows.
