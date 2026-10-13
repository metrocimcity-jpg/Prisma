# Cursor AI Development Workflow

## Before Coding

Always:

1. Inspect repository structure and `.cursor/rules/` for 0.4 product expectations.
2. Identify framework and build system (Vite + React + TypeScript + Vitest).
3. Inspect existing entry points (`AppShell`, store actions, FoamTree adapter).
4. Inspect package/dependency configuration (`pdfjs-dist`, `three`, `web-ifc`, FoamTree).
5. Identify existing conventions and reusable layout/preview/analysis modules.
6. Form a concise implementation plan.

Do not immediately generate large amounts of code.

## During Coding

Work in small coherent increments.

After each meaningful increment:

1. type-check (`npm run typecheck`)
2. run relevant tests (`npm test`)
3. build when appropriate (`npm run build`)
4. fix errors before proceeding

When changing Vite config or FoamTree branding strip, restart the dev server and clear `node_modules/.vite` if the transform does not apply.

## Editing

Prefer targeted edits.

Do not replace entire files unless necessary.

Preserve working functionality (scan → visualize → search/filter → analysis/preview → export).

## Dependencies

Do not add a dependency simply because it is convenient.

Before adding one:

- determine whether existing dependencies solve the problem;
- consider bundle size and WASM/asset packaging (IFC, PDF);
- consider maintenance;
- verify compatibility with Vite 7 / React 19.

## Generated UI

Never create decorative controls that are not implemented.

Every visible setting must either work or be clearly marked as unavailable.

Sidebar rail icons must map to exclusive panels — do not regress to “show all cards on every click.”

More menu actions must close the menu.

## Documentation sync

If the change alters capabilities, commands, layout, presets, or schema, update in the same change set:

- `README.md`
- `CHANGELOG.md`
- relevant `.cursor/rules/*.md` (at least overview / UI / commands / acceptance when user-facing)

## Completion

When a feature is finished, report:

- files changed
- functionality added
- tests run
- build result
- remaining limitations

## Quality Gate

Do not call a prototype "complete" if core workflow is broken.

The application must remain runnable throughout development.
