import { actions, getState } from "@/state/store";
import { findFoamGroupBySourceId, type PrismaFoamGroup } from "@/visualization/foamtree/dataObject";
import { getFoamTreeInstance, preserveFoamSelection, resetFoamTreeView } from "@/visualization/foamtree/host";
import { matchCell } from "@/voice/matchCell";
import type { FoamTree, FoamTreeGroup } from "@carrotsearch/foamtree";
import type { VizNode } from "@/visualization/types";

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

function exposeLevel(foam: FoamTree, path: string[]): void {
  if (path.length === 0) {
    void foam.expose([]);
    return;
  }
  markFoam(foam, "expose", [path[path.length - 1]]);
}

function resolveCell(nameOrId: string): VizNode | null {
  const { vizTree, focusPath, index } = getState();
  if (!vizTree) {
    return null;
  }
  const direct =
    matchCell(vizTree, focusPath, nameOrId) ?? (focusPath.length > 0 ? matchCell(vizTree, [], nameOrId) : null);
  if (direct) {
    return direct;
  }
  const byId = findVizById(vizTree, nameOrId);
  if (byId) {
    return byId;
  }
  if (index) {
    const file = index.items.find(
      (item) => item.id === nameOrId || item.name.toLowerCase() === nameOrId.toLowerCase() || item.relativePath === nameOrId,
    );
    if (file) {
      return matchCell(vizTree, [], file.name) ?? matchCell(vizTree, [], file.relativePath.split("/").pop() ?? file.name);
    }
  }
  return null;
}

function findVizById(node: VizNode, id: string): VizNode | null {
  if (node.id === id || node.sourceId === id) {
    return node;
  }
  for (const child of node.children) {
    const found = findVizById(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Single-click: highlight a cell by label or id. */
export function clickCell(nameOrId: string): { ok: true; id: string; label: string } | { ok: false; message: string } {
  const node = resolveCell(nameOrId);
  if (!node) {
    return { ok: false, message: `No cell named “${nameOrId}”` };
  }
  const chosen = node.nodeType === "file" ? (node.sourceId ?? node.id) : node.id;
  actions.select(chosen);
  const foam = getFoamTreeInstance();
  const data = foam?.get("dataObject") as { groups?: PrismaFoamGroup[] } | null;
  const group = findFoamGroupBySourceId(data?.groups, chosen) ?? findFoamGroupBySourceId(data?.groups, node.id);
  if (foam && group) {
    markFoam(foam, "select", [group.id]);
  }
  return { ok: true, id: chosen, label: node.label };
}

/** Double-click: open a folder (zoom in) or open a file. */
export function openCell(nameOrId: string): { ok: true; id: string; label: string; kind: "folder" | "file" } | { ok: false; message: string } {
  const node = resolveCell(nameOrId);
  if (!node) {
    return { ok: false, message: `No cell named “${nameOrId}”` };
  }
  const foam = getFoamTreeInstance();
  const drill = node.nodeType !== "file" && node.children.length > 0;
  const chosen = node.nodeType === "file" ? (node.sourceId ?? node.id) : node.id;
  actions.select(chosen);
  if (drill) {
    if (foam) {
      markFoam(foam, "select", [node.id]);
      markFoam(foam, "open", [node.id]);
      markFoam(foam, "expose", [node.id]);
    } else {
      actions.drillInto(node.id);
    }
    return { ok: true, id: node.id, label: node.label, kind: "folder" };
  }
  if (foam) {
    markFoam(foam, "select", [node.id]);
  }
  void actions.openNode(chosen);
  return { ok: true, id: chosen, label: node.label, kind: "file" };
}

export function selectEveryCell(): { ok: true; count: number } | { ok: false; message: string } {
  const foam = getFoamTreeInstance();
  const data = foam?.get("dataObject") as { groups?: FoamTreeGroup[] } | null;
  const ids = groupIds(data?.groups);
  if (!foam || ids.length === 0) {
    return { ok: false, message: "No cells to select" };
  }
  preserveFoamSelection();
  markFoam(foam, "select", ids);
  return { ok: true, count: ids.length };
}

export function goBack(): string {
  if (getState().semanticHitIds.length > 0) {
    actions.clearSemanticHits();
    resetFoamTreeView();
    return "Back to previous map";
  }
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

export function resetView(): void {
  actions.select(null);
  actions.setFocusPath([]);
  const foam = getFoamTreeInstance();
  if (!foam) {
    resetFoamTreeView();
    return;
  }
  void foam.expose([]);
  void foam.reset();
}

export function zoom(delta: number, x = 0.5, y = 0.5): boolean {
  const foam = getFoamTreeInstance();
  const host = document.querySelector(".foamtree-host");
  if (!foam || !(host instanceof HTMLElement) || host.clientWidth <= 0) {
    return false;
  }
  if (!Number.isFinite(delta) || delta === 0) {
    return false;
  }
  foam.trigger("mousewheel", {
    x: x * host.clientWidth,
    y: y * host.clientHeight,
    delta: delta > 0 ? 0.5 : -0.5,
  });
  return true;
}
