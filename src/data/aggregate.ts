import type {
  FileIndex,
  FolderStats,
  IndexNode,
  IndexStatistics,
  RawScanEntry,
  ScanError,
} from "./types";
import { GENERATOR_VERSION, SCHEMA_VERSION } from "./types";
import { createNodeId, parentRelativePath } from "./ids";
import type { FileClassifier } from "@/metadata/FileClassifier";
import { defaultClassifier } from "@/metadata/FileClassifier";
import { applyAeVersionHistory } from "@/data/aeVersionHistory";
import { mergeAccTaxonomyMetadata } from "@/metadata/accTaxonomy";

function emptyStats(): FolderStats {
  return {
    fileCount: 0,
    folderCount: 0,
    totalSize: 0,
    categoryCounts: {},
    extensionCounts: {},
    largestFileId: null,
    newestFileId: null,
    oldestFileId: null,
  };
}

function incrementCount(map: Record<string, number>, key: string | null): void {
  if (key === null || key.length === 0) {
    return;
  }
  map[key] = (map[key] ?? 0) + 1;
}

function mergeCounts(target: Record<string, number>, source: Record<string, number>): void {
  for (const [key, value] of Object.entries(source)) {
    target[key] = (target[key] ?? 0) + value;
  }
}

function newerTimestamp(left: string | null, right: string | null): string | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return left >= right ? left : right;
}

function olderTimestamp(left: string | null, right: string | null): string | null {
  if (left === null) {
    return right;
  }
  if (right === null) {
    return left;
  }
  return left <= right ? left : right;
}

export function buildFileIndex(options: {
  rootName: string;
  rootPath: string;
  entries: RawScanEntry[];
  errors?: ScanError[];
  generatedAt?: string;
  classifier?: FileClassifier;
}): FileIndex {
  const classifier = options.classifier ?? defaultClassifier;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const byId = new Map<string, IndexNode>();

  const rootId = createNodeId("");
  const rootNode: IndexNode = {
    id: rootId,
    parentId: null,
    name: options.rootName,
    path: options.rootPath,
    relativePath: "",
    nodeType: "folder",
    extension: null,
    mimeType: null,
    fileType: "Folder",
    category: null,
    subcategory: null,
    size: 0,
    createdAt: null,
    modifiedAt: null,
    accessedAt: null,
    attributes: null,
    stats: emptyStats(),
  };
  byId.set(rootId, rootNode);

  const sortedEntries = [...options.entries].sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  for (const entry of sortedEntries) {
    const id = createNodeId(entry.relativePath);
    if (id === rootId) {
      continue;
    }
    const parentRel = parentRelativePath(entry.relativePath);
    const parentId = parentRel === null ? null : createNodeId(parentRel);
    const classification = classifier.classify({
      name: entry.name,
      mimeHint: entry.mimeHint,
      nodeType: entry.nodeType,
    });
    const node: IndexNode = {
      id,
      parentId,
      name: entry.name,
      path: options.rootPath ? `${options.rootPath}/${entry.relativePath}` : entry.relativePath,
      relativePath: entry.relativePath,
      nodeType: entry.nodeType,
      extension: classification.extension,
      mimeType: classification.mimeType,
      fileType: classification.fileType,
      category: classification.category,
      subcategory: classification.subcategory,
      size: entry.nodeType === "file" ? entry.size : 0,
      createdAt: entry.createdAt,
      modifiedAt: entry.modifiedAt,
      accessedAt: entry.accessedAt,
      attributes: entry.attributes,
      stats: entry.nodeType === "folder" ? emptyStats() : undefined,
    };
    if (entry.nodeType === "file") {
      const enriched = mergeAccTaxonomyMetadata(undefined, entry.name, entry.relativePath);
      if (enriched) {
        node.metadata = enriched;
      }
    }
    byId.set(id, node);
  }

  const nodes = [...byId.values()].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const children = new Map<string, IndexNode[]>();
  for (const node of nodes) {
    if (node.parentId === null) {
      continue;
    }
    const list = children.get(node.parentId) ?? [];
    list.push(node);
    children.set(node.parentId, list);
  }

  const fileById = new Map(nodes.filter((node) => node.nodeType === "file").map((node) => [node.id, node]));

  function aggregate(node: IndexNode): FolderStats {
    if (node.nodeType === "file") {
      return emptyStats();
    }
    const stats = emptyStats();
    const childList = children.get(node.id) ?? [];
    let largestSize = -1;
    let newest: { id: string; at: string } | null = null;
    let oldest: { id: string; at: string } | null = null;

    for (const child of childList) {
      if (child.nodeType === "file") {
        stats.fileCount += 1;
        stats.totalSize += child.size;
        incrementCount(stats.categoryCounts, child.category);
        incrementCount(stats.extensionCounts, child.extension);
        if (child.size > largestSize) {
          largestSize = child.size;
          stats.largestFileId = child.id;
        }
        if (child.modifiedAt !== null) {
          if (newest === null || child.modifiedAt > newest.at) {
            newest = { id: child.id, at: child.modifiedAt };
          }
          if (oldest === null || child.modifiedAt < oldest.at) {
            oldest = { id: child.id, at: child.modifiedAt };
          }
        }
      } else {
        const childStats = aggregate(child);
        stats.fileCount += childStats.fileCount;
        stats.folderCount += childStats.folderCount + 1;
        stats.totalSize += childStats.totalSize;
        mergeCounts(stats.categoryCounts, childStats.categoryCounts);
        mergeCounts(stats.extensionCounts, childStats.extensionCounts);
        const largest = childStats.largestFileId ? fileById.get(childStats.largestFileId) : undefined;
        if (largest && largest.size > largestSize) {
          largestSize = largest.size;
          stats.largestFileId = largest.id;
        }
        const newestChild = childStats.newestFileId ? fileById.get(childStats.newestFileId) : undefined;
        if (newestChild?.modifiedAt) {
          if (newest === null || newestChild.modifiedAt > newest.at) {
            newest = { id: newestChild.id, at: newestChild.modifiedAt };
          }
        }
        const oldestChild = childStats.oldestFileId ? fileById.get(childStats.oldestFileId) : undefined;
        if (oldestChild?.modifiedAt) {
          if (oldest === null || oldestChild.modifiedAt < oldest.at) {
            oldest = { id: oldestChild.id, at: oldestChild.modifiedAt };
          }
        }
      }
    }

    stats.newestFileId = newest?.id ?? null;
    stats.oldestFileId = oldest?.id ?? null;
    node.stats = stats;
    node.size = stats.totalSize;
    node.modifiedAt = newerTimestamp(node.modifiedAt, newest?.at ?? null);
    node.createdAt = olderTimestamp(node.createdAt, oldest?.at ?? null);
    return stats;
  }

  aggregate(rootNode);

  const rootStats = rootNode.stats ?? emptyStats();
  const statistics: IndexStatistics = {
    totalFiles: rootStats.fileCount,
    totalFolders: rootStats.folderCount,
    totalSize: rootStats.totalSize,
    errorCount: options.errors?.length ?? 0,
    categoryCounts: rootStats.categoryCounts,
    extensionCounts: rootStats.extensionCounts,
    largestFileId: rootStats.largestFileId,
    newestFileId: rootStats.newestFileId,
    oldestFileId: rootStats.oldestFileId,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    generatorVersion: GENERATOR_VERSION,
    root: {
      id: rootNode.id,
      name: rootNode.name,
      path: rootNode.path,
    },
    statistics,
    items: nodes,
    errors: options.errors ?? [],
  };
}

export function serializeIndex(index: FileIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function indexToCsv(index: FileIndex): string {
  const header = [
    "id",
    "parentId",
    "name",
    "path",
    "relativePath",
    "nodeType",
    "extension",
    "mimeType",
    "fileType",
    "category",
    "subcategory",
    "size",
    "createdAt",
    "modifiedAt",
    "accessedAt",
  ];
  const rows = index.items.map((node) =>
    [
      node.id,
      node.parentId ?? "",
      node.name,
      node.path,
      node.relativePath,
      node.nodeType,
      node.extension ?? "",
      node.mimeType ?? "",
      node.fileType ?? "",
      node.category ?? "",
      node.subcategory ?? "",
      String(node.size),
      node.createdAt ?? "",
      node.modifiedAt ?? "",
      node.accessedAt ?? "",
    ]
      .map(escapeCsv)
      .join(","),
  );
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** Attach ACC taxonomy metadata to every file node (safe to run on JSON loads too). */
export function enrichFileIndexWithAccTaxonomy(index: FileIndex): FileIndex {
  const tagged: FileIndex = {
    ...index,
    items: index.items.map((item) => {
      if (item.nodeType !== "file") {
        return item;
      }
      const metadata = mergeAccTaxonomyMetadata(item.metadata, item.name, item.relativePath);
      if (!metadata) {
        return item;
      }
      return { ...item, metadata };
    }),
  };
  return applyAeVersionHistory(tagged);
}
