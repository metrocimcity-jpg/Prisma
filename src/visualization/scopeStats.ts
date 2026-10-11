import type { VizNode } from "@/visualization/types";

export interface ScopeTypeStat {
  ext: string;
  count: number;
  size: number;
}

export interface ScopeStats {
  fileCount: number;
  totalSize: number;
  groupCount: number;
  types: ScopeTypeStat[];
}

/** File count, size, and type breakdown for the group currently open in the map. */
export function scopeStats(node: VizNode): ScopeStats {
  const types = new Map<string, ScopeTypeStat>();
  const walk = (current: VizNode): void => {
    if (current.nodeType === "file") {
      const ext = current.extension && current.extension.length > 0 ? current.extension : "no extension";
      const entry = types.get(ext) ?? { ext, count: 0, size: 0 };
      entry.count += 1;
      entry.size += current.size;
      types.set(ext, entry);
      return;
    }
    for (const child of current.children) {
      walk(child);
    }
  };
  walk(node);
  const list = [...types.values()].sort((a, b) => b.size - a.size || b.count - a.count);
  return {
    fileCount: list.reduce((sum, entry) => sum + entry.count, 0),
    totalSize: list.reduce((sum, entry) => sum + entry.size, 0),
    groupCount: node.children.filter((child) => child.nodeType !== "file").length,
    types: list,
  };
}
