import type { IndexNode } from "@/data/types";
import { ACC_METADATA_KEYS, abbreviateAccValue } from "@/metadata/accTaxonomy";
import type { VizNode } from "@/visualization/types";

export const SCHEDULE_ACC_COLUMNS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "ACC-Portfolio", label: "Portfolio" },
  { key: "ACC-Program", label: "Program" },
  { key: "ACC-Sub Program", label: "Sub Program" },
  { key: "ACC-Originator", label: "Originator" },
  { key: "ACC-Location", label: "Location" },
  { key: "ACC-Discipline", label: "Discipline" },
  { key: "ACC-Document Type", label: "Doc Type" },
];

export interface ScheduleRow {
  id: string;
  name: string;
  folder: string;
  size: number;
  extension: string;
  modifiedAt: string | null;
  acc: Record<string, string>;
}

function folderOf(relativePath: string): string {
  const parts = relativePath.split(/[/\\]/).filter((part) => part.length > 0);
  if (parts.length <= 1) {
    return "(root)";
  }
  return parts.slice(0, -1).join("/");
}

function accCells(metadata: Record<string, unknown> | undefined): Record<string, string> {
  const cells: Record<string, string> = {};
  if (!metadata) {
    return cells;
  }
  for (const key of ACC_METADATA_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      cells[key] = abbreviateAccValue(key, value);
    }
  }
  return cells;
}

/** Files under the open map group, in index order. */
export function filesInScope(node: VizNode, byId: ReadonlyMap<string, IndexNode>): IndexNode[] {
  const files: IndexNode[] = [];
  const walk = (current: VizNode): void => {
    if (current.nodeType === "file") {
      const id = current.sourceId ?? current.id;
      const file = byId.get(id);
      if (file?.nodeType === "file") {
        files.push(file);
      }
      return;
    }
    for (const child of current.children) {
      walk(child);
    }
  };
  walk(node);
  return files;
}

export function toScheduleRows(files: readonly IndexNode[]): ScheduleRow[] {
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    folder: folderOf(file.relativePath),
    size: file.size,
    extension: file.extension && file.extension.length > 0 ? file.extension : "—",
    modifiedAt: file.modifiedAt,
    acc: accCells(file.metadata),
  }));
}

export function accColumnsInUse(rows: readonly ScheduleRow[]): Array<{ key: string; label: string }> {
  return SCHEDULE_ACC_COLUMNS.filter((column) => rows.some((row) => row.acc[column.key]));
}
