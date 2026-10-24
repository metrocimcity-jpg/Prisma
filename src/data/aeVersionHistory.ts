import catalogJson from "@/data/aeVersionCatalog.json";
import type { FileIndex, IndexNode } from "@/data/types";

/** Folders whose file names are listed in version/AE-file-names.xlsx. */
export const AE_VERSION_ROOTS = [
  "C:\\Users\\g.vakili\\DC\\ACCDocs\\Mott MacDonald\\GTAA - PACT DJV\\Project Files\\2.5. Shared PDFs\\AE",
  "C:\\Users\\g.vakili\\DC\\ACCDocs\\Mott MacDonald\\GTAA - PACT DJV\\Project Files\\2. Shared\\AE",
] as const;

export const VERSION_HISTORY_KEY = "versionHistory";

export interface AeVersionPoint {
  version: number;
  sizeMb: number;
  modifiedAt: string;
}

type CatalogRow = [number, number, string];

const catalog = catalogJson as { files: Record<string, CatalogRow[]> };

const byName = new Map<string, AeVersionPoint[]>(
  Object.entries(catalog.files).map(([name, rows]) => [
    name,
    rows.map(([version, sizeMb, modifiedAt]) => ({ version, sizeMb, modifiedAt })),
  ]),
);

export function versionHistoryOf(node: IndexNode): AeVersionPoint[] {
  const value = node.metadata?.[VERSION_HISTORY_KEY];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((point): point is AeVersionPoint => {
    if (!point || typeof point !== "object") {
      return false;
    }
    const row = point as AeVersionPoint;
    return typeof row.version === "number" && typeof row.sizeMb === "number" && typeof row.modifiedAt === "string";
  });
}

function normalizePath(value: string): string {
  return value.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase();
}

function filesNamedInWorkbook(index: FileIndex): number {
  let hits = 0;
  for (const item of index.items) {
    if (item.nodeType === "file" && byName.has(item.name.toLowerCase())) {
      hits += 1;
    }
  }
  return hits;
}

/** True when this scan is one of the AE folders the version workbook was built from. */
export function indexUsesAeVersionWorkbook(index: FileIndex): boolean {
  const root = normalizePath(`${index.root.path}\\${index.root.name}`);
  const namedRoot = AE_VERSION_ROOTS.some((path) => root === normalizePath(path) || root.endsWith(normalizePath(path)));
  const hits = filesNamedInWorkbook(index);
  if (namedRoot && hits > 0) {
    return true;
  }
  if (index.root.name.toLowerCase() === "ae" && hits >= 8) {
    return true;
  }
  const nested = index.items.some((item) =>
    /(?:^|\/)(?:2\.5\. shared pdfs\/ae|2\. shared\/ae)(?:\/|$)/i.test(item.relativePath.replace(/\\/g, "/")),
  );
  return nested && hits >= 8;
}

/** Copy version size and modified date from the workbook onto matching file names. */
export function applyAeVersionHistory(index: FileIndex): FileIndex {
  if (!indexUsesAeVersionWorkbook(index)) {
    return index;
  }
  return {
    ...index,
    items: index.items.map((item) => {
      if (item.nodeType !== "file") {
        return item;
      }
      const history = byName.get(item.name.toLowerCase());
      if (!history) {
        return item;
      }
      return {
        ...item,
        metadata: { ...item.metadata, [VERSION_HISTORY_KEY]: history },
      };
    }),
  };
}
