import { isAccMetadataAlias } from "@/metadata/accTaxonomy";
import type { GroupLevel } from "@/visualization/types";

export interface HierarchyField {
  id: GroupLevel;
  label: string;
}

/** Built-in file fields, then ACC taxonomy fields the tool already understands. */
export const HIERARCHY_FIELDS: HierarchyField[] = [
  { id: "folder", label: "Folder" },
  { id: "category", label: "Category" },
  { id: "fileType", label: "File type" },
  { id: "extension", label: "Extension" },
  { id: "size", label: "File size" },
  { id: "date", label: "Date modified" },
  { id: "subcategory", label: "Subcategory" },
  { id: "mimeType", label: "MIME type" },
  { id: "accDiscipline", label: "Discipline" },
  { id: "accDocumentType", label: "Document type" },
  { id: "accPortfolio", label: "Portfolio" },
  { id: "accProgram", label: "Program" },
  { id: "accSubProgram", label: "Sub program" },
  { id: "accOriginator", label: "Originator" },
  { id: "accLocation", label: "Location" },
];

export function formatPropertyLabel(key: string): string {
  return key
    .replace(/^meta:/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Built-in fields, ACC fields, then any extra keys from a JSON index or ACC item metadata. */
export function hierarchyCatalog(metadataKeys: readonly string[]): HierarchyField[] {
  const dynamic = metadataKeys
    .filter((key) => !isAccMetadataAlias(key))
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ id: `meta:${key}` as const, label: formatPropertyLabel(key) }));
  return [...HIERARCHY_FIELDS, ...dynamic];
}

/** Active levels first, then the previous order of the rest, then any new keys. */
export function mergeHierarchyOrder(previous: readonly string[], catalogIds: readonly string[], active: readonly string[]): string[] {
  const catalog = new Set(catalogIds);
  const activeIds = active.filter((id) => catalog.has(id));
  const activeSet = new Set(activeIds);
  const inactive = previous.filter((id) => catalog.has(id) && !activeSet.has(id));
  const seen = new Set([...activeIds, ...inactive]);
  const rest = catalogIds.filter((id) => !seen.has(id));
  return [...activeIds, ...inactive, ...rest];
}

export function ensureCatalog(order: readonly string[], catalogIds: readonly string[]): string[] {
  const catalog = new Set(catalogIds);
  const kept = order.filter((id) => catalog.has(id));
  const seen = new Set(kept);
  return [...kept, ...catalogIds.filter((id) => !seen.has(id))];
}

/** Move `draggingId` before or after `targetId`. Returns the same array when nothing changes. */
export function moveHierarchyItem(order: readonly string[], draggingId: string, targetId: string, placeBefore: boolean): string[] {
  if (draggingId === targetId) {
    return order as string[];
  }
  const from = order.indexOf(draggingId);
  const target = order.indexOf(targetId);
  if (from < 0 || target < 0) {
    return order as string[];
  }
  const next = order.filter((id) => id !== draggingId);
  const index = next.indexOf(targetId);
  next.splice(placeBefore ? index : index + 1, 0, draggingId);
  if (next.length === order.length && next.every((id, index) => id === order[index])) {
    return order as string[];
  }
  return next;
}

/** Checked fields in list order. An empty selection falls back to the folder tree. */
export function hierarchyGroupBy(order: readonly string[], activeIds: readonly string[]): GroupLevel[] {
  const active = new Set(activeIds);
  const levels: string[] = order.filter((id) => active.has(id));
  for (const id of activeIds) {
    if (!levels.includes(id)) {
      levels.push(id);
    }
  }
  return (levels.length > 0 ? levels : ["folder"]) as GroupLevel[];
}
