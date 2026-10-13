# Git and Documentation Rules

## Commits

Keep commits focused.

Prefer:

```text
feat(scanner): add recursive filesystem indexing
feat(search): add fuzzy filename search
feat(view): add category clustering
feat(preview): add IFC stage
feat(analysis): add folder-scoped bubble chart
fix(ui): show one sidebar panel per rail icon
fix(ui): close More menu after submenu choice
perf(view): reduce rendering cost for large indexes
```

Avoid giant commits containing unrelated changes.

## Documentation

Update documentation **and** `.cursor/rules/` when:

- public configuration changes
- JSON schema changes
- setup / dependency changes (PDF, IFC, FoamTree, Vite plugins)
- commands or keyboard shortcuts change
- new metadata providers or ACC taxonomy behavior is added
- new visualization / analysis / preview modes are added
- FoamTree defaults / style presets / branding strip change
- Disk Prisma vs factory default behavior changes
- Settings, sidebar rail, Analysis, Preview, or More-menu UX change
- product version capabilities ship (bump `CHANGELOG.md` and usually `package.json` version)

Keep these in sync with the product:

- `README.md` — capabilities table, workflow, UI layout, shortcuts
- `CHANGELOG.md` — significant user-visible changes
- `.cursor/rules/README.md` — index + product decisions
- `.cursor/rules/00-project-overview.md` — mission, capabilities, workflow
- `.cursor/rules/01-architecture.md` — module map
- `.cursor/rules/06-visualization.md` — FoamTree adapter + branding
- `.cursor/rules/08-ui-ux.md` — chrome and panel UX
- `.cursor/rules/13-cursor-workflow.md` — agent implementation workflow
- `.cursor/rules/15-config-and-presets.md` — presets
- `.cursor/rules/16-acceptance-criteria.md` — definition of done
- `.cursor/rules/17-commands-and-shortcuts.md` — commands map

## README

README should explain:

- project purpose and current version
- capabilities summary
- FoamTree default vs Disk Prisma preset
- architecture
- prerequisites, install, development, build
- scanning, JSON index
- UI layout (rail sections, Analysis, Preview, More)
- configuration / settings / presets
- keyboard shortcuts
- agent docs pointer (`.cursor/rules/`)
- troubleshooting

## Changelog

Maintain a concise changelog for significant user-visible changes. Prefer semver-ish product versions (`0.4.0`, …) that match marketed capabilities even if historical `generatorVersion` inside indexes stays `1.0` schema-oriented.
