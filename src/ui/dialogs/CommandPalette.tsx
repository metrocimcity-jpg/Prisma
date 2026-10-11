import { actions, usePrisma } from "@/state/store";
import { useEffect, useMemo, useState } from "react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette(): JSX.Element | null {
  const { panels } = usePrisma();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const commands: Command[] = useMemo(
    () => [
      { id: "open-folder", label: "Open Folder", shortcut: "Ctrl+O", run: () => void actions.openFolder() },
      { id: "merge-folder", label: "Merge Folder", run: () => void actions.mergeFolder() },
      { id: "open-json", label: "Open JSON", shortcut: "Ctrl+Shift+O", run: () => void actions.openJson() },
      { id: "merge-json", label: "Merge JSON", run: () => void actions.mergeJson() },
      { id: "browse-sharepoint", label: "Browse SharePoint", run: () => actions.setPanel("sharePointBrowser", true) },
      {
        id: "style-foamtree",
        label: "Style: FoamTree",
        run: () => actions.patchVisualization({ renderer: "foamtree", layout: "foam" }),
      },
      {
        id: "style-circle-packing",
        label: "Style: Zoomable Circle Packing",
        run: () => actions.patchVisualization({ renderer: "circlePacking", layout: "circles" }),
      },
      {
        id: "style-sequences-sunburst",
        label: "Style: Sequences Sunburst",
        run: () => actions.patchVisualization({ renderer: "sequencesSunburst", layout: "sunburst" }),
      },
      {
        id: "style-sunburst",
        label: "Style: Sunburst",
        run: () => actions.patchVisualization({ renderer: "sunburst", layout: "sunburst" }),
      },
      { id: "resolve-acc", label: "Resolve ACC Links", run: () => void actions.resolveAccLinks() },
      { id: "open-selected", label: "Open Selected File", shortcut: "Enter", run: () => void actions.openSelected() },
      { id: "export-json", label: "Export JSON", run: () => actions.exportJson() },
      { id: "export-csv", label: "Export CSV", run: () => actions.exportCsv() },
      { id: "save-workspace", label: "Save Workspace", run: () => actions.exportWorkspace() },
      { id: "sample", label: "Load Sample Index", run: () => actions.loadSample() },
      { id: "clear-filters", label: "Clear Filters", run: () => actions.clearFilters() },
      { id: "reset-viz", label: "Reset Visualization", run: () => actions.resetVisualization() },
      { id: "theme", label: "Toggle Dark Mode", run: () => actions.setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark") },
      { id: "details", label: "Toggle Details", run: () => actions.togglePanel("details") },
      { id: "filters", label: "Toggle Filters", run: () => actions.togglePanel("filters") },
      { id: "analysis", label: "Open Analysis", run: () => actions.setPanel("analysis", true) },
      { id: "preview", label: "Open Preview", run: () => actions.setPanel("preview", true) },
      { id: "settings", label: "Open Settings", run: () => actions.setPanel("settings", true) },
    ],
    [],
  );

  const filtered = commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    setActive(0);
  }, [query, panels.commandPalette]);

  if (!panels.commandPalette) {
    return null;
  }

  const run = (command: Command): void => {
    command.run();
    actions.setPanel("commandPalette", false);
    setQuery("");
  };

  return (
    <div
      className="overlay"
      onClick={() => actions.setPanel("commandPalette", false)}
      role="dialog"
      aria-label="Command palette"
    >
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <header>
          <input
            autoFocus
            value={query}
            placeholder="Type a command…"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((value) => Math.min(value + 1, filtered.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter" && filtered[active]) {
                run(filtered[active]);
              } else if (event.key === "Escape") {
                actions.setPanel("commandPalette", false);
              }
            }}
          />
        </header>
        {filtered.map((command, index) => (
          <button
            key={command.id}
            type="button"
            className={index === active ? "command-item active" : "command-item"}
            onClick={() => run(command)}
          >
            {command.label}
            {command.shortcut ? <span className="kicker"> {command.shortcut}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
