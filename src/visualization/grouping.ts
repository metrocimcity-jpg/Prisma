import type { FileIndex, IndexNode } from "@/data/types";
import { ACC_METADATA_KEYS, accMetadataRaw, presentAccValue } from "@/metadata/accTaxonomy";
import type { GroupBy, GroupLevel, SizeBy, VizNode } from "./types";
import { defaultSizeMapper } from "./SizeMapper";

const OTHER_LABEL = "Other";

const ACC_GROUP_KEYS: Partial<Record<GroupBy, string>> = {
  accPortfolio: "ACC-Portfolio",
  accProgram: "ACC-Program",
  accSubProgram: "ACC-Sub Program",
  accOriginator: "ACC-Originator",
  accLocation: "ACC-Location",
  accDiscipline: "ACC-Discipline",
  accDocumentType: "ACC-Document Type",
};

function metadataLabel(node: IndexNode, property: string): string {
  const value = node.metadata?.[property];
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return "(none)";
  }
  const text = String(value);
  if ((ACC_METADATA_KEYS as readonly string[]).includes(property)) {
    return presentAccValue(property, text);
  }
  return text;
}

function groupKey(node: IndexNode, key: GroupLevel, customProperty: string): string {
  if (key.startsWith("meta:")) {
    return metadataLabel(node, key.slice(5));
  }
  const accKey = ACC_GROUP_KEYS[key as GroupBy];
  if (accKey) {
    const value = accMetadataRaw(node.metadata, accKey);
    return value === null ? "(none)" : presentAccValue(accKey, value);
  }
  switch (key) {
    case "extension":
      return node.extension ?? "(none)";
    case "fileType":
      return node.fileType ?? OTHER_LABEL;
    case "category":
      return node.category ?? OTHER_LABEL;
    case "subcategory":
      return node.subcategory ?? OTHER_LABEL;
    case "mimeType":
      return node.mimeType ?? "(none)";
    case "date":
      return node.modifiedAt ? node.modifiedAt.slice(0, 7) : "(unknown date)";
    case "size":
      return sizeBucket(node.size);
    case "owner":
      return "(owner unavailable)";
    case "drive":
      return node.path.slice(0, 2) || "(drive)";
    case "path": {
      const first = node.relativePath.split("/")[0];
      return first && first.length > 0 ? first : node.name;
    }
    case "custom": {
      const value = node.metadata?.[customProperty];
      if (value === undefined || value === null || String(value).trim().length === 0) {
        return "(none)";
      }
      if ((ACC_METADATA_KEYS as readonly string[]).includes(customProperty)) {
        return presentAccValue(customProperty, String(value));
      }
      return String(value);
    }
    case "folder": {
      const parts = node.relativePath.split("/").filter((part) => part.length > 0);
      if (parts.length <= 1) {
        return "(root)";
      }
      return parts[parts.length - 2] ?? "(root)";
    }
    default:
      return node.parentId ?? "/";
  }
}

function sizeBucket(size: number): string {
  if (size < 10 * 1024) {
    return "0 – 10 KB";
  }
  if (size < 100 * 1024) {
    return "10 – 100 KB";
  }
  if (size < 1024 ** 2) {
    return "100 KB – 1 MB";
  }
  if (size < 10 * 1024 ** 2) {
    return "1 – 10 MB";
  }
  if (size < 100 * 1024 ** 2) {
    return "10 – 100 MB";
  }
  return "100 MB +";
}

function colorKeyFor(node: IndexNode, colorByFallback: GroupLevel, customProperty: string): string {
  return groupKey(node, colorByFallback, customProperty);
}

export function buildFolderTree(
  index: FileIndex,
  visibleIds: Set<string>,
  sizeBy: SizeBy,
  customProperty: string,
): VizNode {
  const byParent = new Map<string | null, IndexNode[]>();
  for (const node of index.items) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  const build = (node: IndexNode): VizNode | null => {
    if (node.nodeType === "file" && !visibleIds.has(node.id)) {
      return null;
    }
    const children = (byParent.get(node.id) ?? [])
      .map(build)
      .filter((child): child is VizNode => child !== null);
    if (node.nodeType === "folder" && children.length === 0 && node.id !== index.root.id) {
      if (!visibleIds.has(node.id)) {
        return null;
      }
    }
    const weight =
      node.nodeType === "folder"
        ? children.reduce((sum, child) => sum + child.weight, 0) || defaultSizeMapper.weight(node, sizeBy, customProperty)
        : defaultSizeMapper.weight(node, sizeBy, customProperty);
    return {
      id: `fs:${node.id}`,
      sourceId: node.id,
      label: node.name,
      weight,
      colorKey: node.category ?? node.extension ?? node.name,
      nodeType: node.nodeType,
      category: node.category,
      extension: node.extension,
      fileType: node.fileType,
      size: node.nodeType === "folder" ? (node.stats?.totalSize ?? node.size) : node.size,
      fileCount: node.nodeType === "folder" ? (node.stats?.fileCount ?? children.length) : 1,
      modifiedAt: node.modifiedAt,
      children,
    };
  };

  const root = index.items.find((item) => item.id === index.root.id);
  if (!root) {
    return emptyRoot(index.root.name);
  }
  return build(root) ?? emptyRoot(index.root.name);
}

export function buildGroupedTree(
  index: FileIndex,
  visibleIds: Set<string>,
  groups: GroupLevel[],
  sizeBy: SizeBy,
  customProperty: string,
): VizNode {
  if (groups.length === 0 || (groups.length === 1 && groups[0] === "folder")) {
    return buildFolderTree(index, visibleIds, sizeBy, customProperty);
  }

  const files = index.items.filter((item) => item.nodeType === "file" && visibleIds.has(item.id));
  const root: VizNode = {
    id: "group:root",
    sourceId: index.root.id,
    label: index.root.name,
    weight: 0,
    colorKey: "root",
    nodeType: "group",
    category: null,
    extension: null,
    fileType: null,
    size: 0,
    fileCount: 0,
    children: [],
  };

  const ensure = (parent: VizNode, id: string, label: string, colorKey: string): VizNode => {
    let child = parent.children.find((item) => item.id === id);
    if (!child) {
      child = {
        id,
        sourceId: null,
        label,
        weight: 0,
        colorKey,
        nodeType: "group",
        category: groups[0] === "category" ? label : null,
        extension: groups[0] === "extension" ? label : null,
        fileType: groups[0] === "fileType" ? label : null,
        size: 0,
        fileCount: 0,
        children: [],
      };
      parent.children.push(child);
    }
    return child;
  };

  for (const file of files) {
    let cursor = root;
    groups.forEach((group, index) => {
      const label = groupKey(file, group, customProperty);
      cursor = ensure(cursor, `${cursor.id}/${group}:${label}`, label, label);
      if (index === 0) {
        cursor.category = file.category;
        cursor.extension = file.extension;
        cursor.fileType = file.fileType;
      }
    });
    const leaf: VizNode = {
      id: `fs:${file.id}`,
      sourceId: file.id,
      label: file.name,
      weight: defaultSizeMapper.weight(file, sizeBy, customProperty),
      colorKey: colorKeyFor(file, groups[0], customProperty),
      nodeType: "file",
      category: file.category,
      extension: file.extension,
      fileType: file.fileType,
      size: file.size,
      fileCount: 1,
      modifiedAt: file.modifiedAt,
      children: [],
    };
    cursor.children.push(leaf);
  }

  const rollup = (node: VizNode): void => {
    for (const child of node.children) {
      rollup(child);
    }
    if (node.children.length > 0) {
      node.weight = node.children.reduce((sum, child) => sum + child.weight, 0);
      node.size = node.children.reduce((sum, child) => sum + child.size, 0);
      node.fileCount = node.children.reduce((sum, child) => sum + child.fileCount, 0);
    }
  };
  rollup(root);
  collapseOther(root, 400);
  return root;
}

function collapseOther(node: VizNode, maxChildren: number): void {
  for (const child of node.children) {
    collapseOther(child, maxChildren);
  }
  if (node.children.length <= maxChildren) {
    return;
  }
  const sorted = [...node.children].sort((a, b) => b.weight - a.weight);
  const kept = sorted.slice(0, maxChildren - 1);
  const rest = sorted.slice(maxChildren - 1);
  const other: VizNode = {
    id: `${node.id}/other`,
    sourceId: null,
    label: `${OTHER_LABEL} (${rest.length})`,
    weight: rest.reduce((sum, child) => sum + child.weight, 0),
    colorKey: OTHER_LABEL,
    nodeType: "group",
    category: null,
    extension: null,
    fileType: null,
    size: rest.reduce((sum, child) => sum + child.size, 0),
    fileCount: rest.reduce((sum, child) => sum + child.fileCount, 0),
    children: rest,
  };
  node.children = [...kept, other];
}

function emptyRoot(name: string): VizNode {
  return {
    id: "group:root",
    sourceId: null,
    label: name,
    weight: 1,
    colorKey: "root",
    nodeType: "group",
    category: null,
    extension: null,
    fileType: null,
    size: 0,
    fileCount: 0,
    children: [],
  };
}

/**
 * Temporary FoamTree layout for Ask Prisma: hit files as root siblings
 * so they sit beside each other on the map (not nested under folders).
 */
export function buildSemanticResultTree(
  index: FileIndex,
  hitIds: string[],
  sizeBy: SizeBy,
  customProperty: string,
  label = "Ask results",
): VizNode {
  const byId = new Map(index.items.map((item) => [item.id, item]));
  const files = hitIds
    .map((id) => byId.get(id))
    .filter((node): node is IndexNode => Boolean(node) && node.nodeType === "file");

  const root = emptyRoot(label);
  root.id = "semantic:root";
  root.sourceId = index.root.id;
  root.children = files.map((file) => ({
    id: `fs:${file.id}`,
    sourceId: file.id,
    label: file.name,
    weight: defaultSizeMapper.weight(file, sizeBy, customProperty),
    colorKey: file.category ?? file.extension ?? file.name,
    nodeType: "file" as const,
    category: file.category,
    extension: file.extension,
    fileType: file.fileType,
    size: file.size,
    fileCount: 1,
    modifiedAt: file.modifiedAt,
    children: [],
  }));
  root.weight = root.children.reduce((sum, child) => sum + child.weight, 0) || 1;
  root.size = root.children.reduce((sum, child) => sum + child.size, 0);
  root.fileCount = root.children.length;
  return root;
}

export class FolderGrouping implements GroupingStrategy {
  build(index: FileIndex, visibleIds: Set<string>, sizeBy: SizeBy, customProperty: string): VizNode {
    return buildFolderTree(index, visibleIds, sizeBy, customProperty);
  }
}

export interface GroupingStrategy {
  build(index: FileIndex, visibleIds: Set<string>, sizeBy: SizeBy, customProperty: string): VizNode;
}
