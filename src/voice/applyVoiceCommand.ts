import { emptyFilterState } from "@/filtering/FilterEngine";
import { actions, getState } from "@/state/store";
import { getFoamTreeInstance, preserveFoamSelection } from "@/visualization/foamtree/host";
import type { FoamTree, FoamTreeGroup } from "@carrotsearch/foamtree";
import { matchCell } from "@/voice/matchCell";
import type { VoiceCommand } from "@/voice/parseVoiceUtterance";
import { resolveFilter } from "@/voice/resolveFilter";

/** Run one command that was spoken after "Prisma". Returns the status line. */
export function applyVoiceCommand(command: VoiceCommand): string {
  switch (command.type) {
    case "wake":
      return "Listening";
    case "sleep":
      return "Asleep. Say Prisma.";
    case "back":
      return runBack();
    case "reset":
      runReset();
      return "View reset";
    case "selectAll":
      return selectEveryCell();
    case "select":
      return selectNamed(command.name);
    case "filterClear":
      actions.clearFilters();
      showFilters();
      return "Filters cleared";
    case "filterPanel":
      showFilters();
      return "Filters";
    case "filter":
      return applyFilter(command.query);
    default:
      return "";
  }
}

function showFilters(): void {
  if (!getState().panels.filters) {
    actions.togglePanel("filters");
  }
}

function applyFilter(query: string): string {
  const resolved = resolveFilter(query);
  if (resolved.search) {
    actions.setSearch(resolved.search);
    showFilters();
    return `Showing “${resolved.label}”`;
  }
  actions.setSearch("");
  actions.setFilters({
    ...emptyFilterState(),
    categories: resolved.categories,
    extensions: resolved.extensions,
  });
  showFilters();
  return `Filter ${resolved.label}`;
}

function selectNamed(name: string): string {
  const { vizTree, focusPath } = getState();
  if (!vizTree) {
    return "Load a map first";
  }
  const node = matchCell(vizTree, focusPath, name) ?? (focusPath.length > 0 ? matchCell(vizTree, [], name) : null);
  if (!node) {
    return `No cell named “${name}”`;
  }
  const foam = getFoamTreeInstance();
  const drill = node.nodeType !== "file" && node.children.length > 0;
  const chosen = node.nodeType === "file" ? (node.sourceId ?? node.id) : node.id;
  actions.select(chosen);
  if (!foam) {
    if (drill) {
      actions.drillInto(node.id);
    } else if (node.nodeType === "file") {
      void actions.openNode(chosen);
    }
    return drill || node.nodeType === "file" ? `Opened ${node.label}` : `Selected ${node.label}`;
  }
  // A raw data object can carry selected:false / exposed:false, which FoamTree reads as "turn this off".
  markFoam(foam, "select", [node.id]);
  if (drill) {
    markFoam(foam, "open", [node.id]);
    markFoam(foam, "expose", [node.id]);
    return `Opened ${node.label}`;
  }
  if (node.nodeType === "file") {
    void actions.openNode(chosen);
    return `Opened ${node.label}`;
  }
  return `Selected ${node.label}`;
}

function selectEveryCell(): string {
  const foam = getFoamTreeInstance();
  const data = foam?.get("dataObject") as { groups?: FoamTreeGroup[] } | null;
  const ids = groupIds(data?.groups);
  if (!foam || ids.length === 0) {
    return "No cells to select";
  }
  preserveFoamSelection();
  markFoam(foam, "select", ids);
  return "Selected every cell";
}

function runBack(): string {
  const foam = getFoamTreeInstance();
  const path = getState().focusPath;
  if (path.length > 0) {
    const parent = path.slice(0, -1);
    actions.setFocusPath(parent);
    if (foam) {
      exposeLevel(foam, parent);
    }
    return "Back";
  }
  const exposed = groupIds(foam?.get("exposure"));
  if (foam && exposed.length > 0) {
    exposeLevel(foam, exposed.slice(0, -1));
    return "Back";
  }
  if (foam) {
    void foam.reset();
    actions.select(null);
    return "Back";
  }
  actions.navigateBack();
  return "Back";
}

function exposeLevel(foam: FoamTree, path: string[]): void {
  if (path.length === 0) {
    void foam.expose([]);
    return;
  }
  markFoam(foam, "expose", [path[path.length - 1]]);
}

function runReset(): void {
  actions.select(null);
  actions.setFocusPath([]);
  const foam = getFoamTreeInstance();
  if (!foam) {
    return;
  }
  void foam.expose([]);
  void foam.reset();
}

function markFoam(foam: FoamTree, method: "select" | "expose" | "open", ids: string[]): void {
  const flag = method === "select" ? "selected" : method === "expose" ? "exposed" : "open";
  void foam[method]({ groups: ids, [flag]: true, keepPrevious: method === "open" });
}

function groupIds(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { groups?: unknown }).groups)
      ? (value as { groups: unknown[] }).groups
      : [];
  const ids: string[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const group = item as FoamTreeGroup;
    if (group.attribution === true || group.description === true) {
      continue;
    }
    if (typeof group.id === "string" && group.id.length > 0) {
      ids.push(group.id);
    }
  }
  return ids;
}
