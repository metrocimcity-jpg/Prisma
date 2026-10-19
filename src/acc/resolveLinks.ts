import {
  fetchAttributeDefinitionNames,
  fetchCustomAttributesByVersion,
  mergeAccSheet,
  standardAccValues,
} from "@/acc/attributes";
import { listFolderContents, listItemVersions, listTopFolders, type AccFolderContentItem } from "@/acc/dataManagement";
import { versionSizeFields, type AccVersionSize } from "@/acc/versions";
import { buildAccDocsUrl } from "@/acc/urls";
import type { FileIndex, IndexNode } from "@/data/types";

export interface AccResolveProgress {
  resolved: number;
  total: number;
  currentPath: string;
  message: string;
}

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase();
}

function findChild(items: AccFolderContentItem[], name: string, type?: "folders" | "items"): AccFolderContentItem | null {
  const target = normalizeSegment(name);
  const matches = items.filter((item) => normalizeSegment(item.displayName) === target);
  if (type) {
    return matches.find((item) => item.type === type) ?? null;
  }
  return matches[0] ?? null;
}

/** An ACC document found by file name, including the folder it lives in. */
export interface AccNamedFile {
  name: string;
  entityId: string;
  folderUrn: string;
  folderPath: string;
  tipVersionId?: string;
  createUserName?: string;
  lastModifiedUserName?: string;
  lastModifiedTime?: string;
}

/**
 * Pick the ACC document with this file name.
 * A matching parent folder wins. One name in several folders is marked ambiguous.
 */
export function pickAccFileByName(
  relativePath: string,
  hits: readonly AccNamedFile[],
): { file: AccNamedFile; ambiguous: boolean } | null {
  if (hits.length === 0) {
    return null;
  }
  const parent = relativePath.split("/").filter(Boolean).slice(0, -1).join("/").toLowerCase();
  if (parent.length > 0) {
    const folderMatches = hits.filter((hit) => {
      const folder = hit.folderPath.toLowerCase();
      return folder === parent || folder.endsWith(`/${parent}`);
    });
    if (folderMatches.length === 1) {
      return { file: folderMatches[0], ambiguous: false };
    }
    if (folderMatches.length > 1) {
      return { file: folderMatches[0], ambiguous: true };
    }
  }
  return { file: hits[0], ambiguous: hits.length > 1 };
}

interface MatchedAccFile {
  fileId: string;
  entityId: string;
  folderUrn: string;
  tipVersionId?: string;
  createUserName?: string;
  lastModifiedUserName?: string;
  lastModifiedTime?: string;
}

export function accMetadataDocument(
  index: FileIndex,
  extra?: { error?: string | null; attributes?: readonly string[] },
): string {
  const files = index.items
    .filter((item) => item.nodeType === "file")
    .map((item) => {
      const metadata = { ...(item.metadata ?? {}) };
      const versions = metadata.accVersions;
      delete metadata.accVersions;
      return {
        path: item.relativePath,
        name: item.name,
        ...(Array.isArray(versions) && versions.length > 0 ? { versions } : {}),
        metadata,
      };
    });
  return `${JSON.stringify(
    {
      ...(extra?.error ? { error: extra.error } : {}),
      ...(extra?.attributes && extra.attributes.length > 0 ? { attributes: extra.attributes } : {}),
      files,
    },
    null,
    2,
  )}\n`;
}

export async function resolveAccLinks(
  index: FileIndex,
  projectId: string,
  onProgress?: (progress: AccResolveProgress) => void,
): Promise<{
  index: FileIndex;
  resolved: number;
  missing: number;
  metadataAttached: number;
  metadataNote: string | null;
  attributeNames: string[];
  nameMatched: number;
  ambiguous: number;
}> {
  const files = index.items.filter((item) => item.nodeType === "file");
  const total = files.length;
  let resolved = 0;
  let missing = 0;

  const topFolders = await listTopFolders(projectId);
  const projectFiles =
    findChild(topFolders, "Project Files", "folders") ??
    findChild(topFolders, "Project Files") ??
    topFolders.find((item) => item.type === "folders") ??
    null;
  if (!projectFiles) {
    throw new Error("Could not find an ACC top folder (expected Project Files).");
  }

  const cache = new Map<string, AccFolderContentItem[]>();
  const load = async (folderId: string): Promise<AccFolderContentItem[]> => {
    const cached = cache.get(folderId);
    if (cached) {
      return cached;
    }
    const contents = await listFolderContents(projectId, folderId);
    cache.set(folderId, contents);
    return contents;
  };

  const byId = new Map<string, IndexNode>();
  for (const item of index.items) {
    byId.set(item.id, item);
  }
  const matched: MatchedAccFile[] = [];
  const unmatched: IndexNode[] = [];

  const attach = (
    file: IndexNode,
    hit: {
      entityId: string;
      folderUrn: string;
      tipVersionId?: string;
      createUserName?: string;
      lastModifiedUserName?: string;
      lastModifiedTime?: string;
    },
  ): void => {
    const accUrl = buildAccDocsUrl({
      projectId,
      entityId: hit.entityId,
      folderUrn: hit.folderUrn,
    });
    const current = byId.get(file.id);
    if (!current) {
      return;
    }
    byId.set(file.id, {
      ...current,
      metadata: {
        ...(current.metadata ?? {}),
        accUrl,
        entityId: hit.entityId,
        folderUrn: hit.folderUrn,
      },
    });
    matched.push({
      fileId: file.id,
      entityId: hit.entityId,
      folderUrn: hit.folderUrn,
      tipVersionId: hit.tipVersionId,
      createUserName: hit.createUserName,
      lastModifiedUserName: hit.lastModifiedUserName,
      lastModifiedTime: hit.lastModifiedTime,
    });
    resolved += 1;
  };

  for (const file of files) {
    onProgress?.({
      resolved,
      total,
      currentPath: file.relativePath,
      message: `Resolving ACC link ${resolved + 1}/${total}`,
    });

    const segments = file.relativePath.split("/").filter(Boolean);
    // If the scan root already is Project Files contents, segments are under Project Files.
    // If scan root includes Project Files as first segment, skip it.
    const pathSegments =
      segments[0] && normalizeSegment(segments[0]) === "project files" ? segments.slice(1) : segments;

    let folderId = projectFiles.id;
    let parentFolderUrn = projectFiles.id;
    let failed = false;

    for (let i = 0; i < pathSegments.length - 1; i += 1) {
      const contents = await load(folderId);
      const child = findChild(contents, pathSegments[i], "folders") ?? findChild(contents, pathSegments[i]);
      if (!child || child.type !== "folders") {
        failed = true;
        break;
      }
      folderId = child.id;
      parentFolderUrn = child.id;
    }

    if (failed || pathSegments.length === 0) {
      unmatched.push(file);
      continue;
    }

    const fileName = pathSegments[pathSegments.length - 1];
    const contents = await load(folderId);
    const item = findChild(contents, fileName, "items") ?? findChild(contents, fileName);
    if (!item || item.type === "folders") {
      unmatched.push(file);
      continue;
    }

    attach(file, {
      entityId: item.id,
      folderUrn: parentFolderUrn,
      tipVersionId: item.tipVersionId,
      createUserName: item.createUserName,
      lastModifiedUserName: item.lastModifiedUserName,
      lastModifiedTime: item.lastModifiedTime,
    });
  }

  let nameMatched = 0;
  let ambiguous = 0;
  if (unmatched.length > 0) {
    onProgress?.({
      resolved,
      total,
      currentPath: "",
      message: `Searching ACC by file name for ${unmatched.length} files…`,
    });
    const byName = await indexAccFilesByName(projectFiles.id, projectFiles.displayName, load, (folderCount) => {
      onProgress?.({
        resolved,
        total,
        currentPath: "",
        message: `Searching ACC folders (${folderCount})…`,
      });
    });
    for (const file of unmatched) {
      const picked = pickAccFileByName(file.relativePath, byName.get(normalizeSegment(file.name)) ?? []);
      if (!picked) {
        missing += 1;
        continue;
      }
      if (picked.ambiguous) {
        ambiguous += 1;
      }
      nameMatched += 1;
      attach(file, picked.file);
    }
  }

  let metadataAttached = 0;
  let metadataNote: string | null = null;
  const attributeNames = new Set<string>();
  if (matched.length > 0) {
    onProgress?.({
      resolved,
      total,
      currentPath: "",
      message: `Reading ACC metadata for ${matched.length} files…`,
    });
    const sheets = new Map<string, Record<string, string>>();
    try {
      const namesById = await fetchAttributeDefinitionNames(
        projectId,
        matched.map((match) => match.folderUrn),
      );
      const custom = await fetchCustomAttributesByVersion(
        projectId,
        matched.flatMap((match) => [match.entityId, match.tipVersionId ?? ""]),
        namesById,
      );
      for (const [urn, values] of custom) {
        sheets.set(urn, values);
      }
    } catch (error) {
      metadataNote = error instanceof Error ? error.message : "ACC custom attributes could not be read";
    }
    const versionSizes = new Map<string, AccVersionSize[]>();
    let versionFailures = 0;
    let versionCursor = 0;
    const readVersionSizes = async (): Promise<void> => {
      for (;;) {
        const index = versionCursor;
        versionCursor += 1;
        if (index >= matched.length) {
          return;
        }
        const match = matched[index];
        onProgress?.({
          resolved,
          total,
          currentPath: "",
          message: `Reading version sizes ${index + 1}/${matched.length}…`,
        });
        try {
          versionSizes.set(match.fileId, await listItemVersions(projectId, match.entityId));
        } catch (error) {
          versionFailures += 1;
          if (!metadataNote) {
            metadataNote = error instanceof Error ? error.message : "ACC version sizes could not be read";
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, matched.length) }, () => readVersionSizes()));
    if (versionFailures > 0) {
      const failureNote = `Version sizes missing for ${versionFailures} files.`;
      metadataNote = metadataNote ? `${metadataNote} ${failureNote}` : failureNote;
    }
    for (const match of matched) {
      const custom = sheets.get(match.entityId) ?? (match.tipVersionId ? sheets.get(match.tipVersionId) : undefined);
      const versions = versionSizes.get(match.fileId) ?? [];
      const values = { ...standardAccValues(match), ...(custom ?? {}), ...versionSizeFields(versions) };
      if (Object.keys(values).length === 0 && versions.length === 0) {
        continue;
      }
      for (const name of Object.keys(values)) {
        attributeNames.add(name);
      }
      const current = byId.get(match.fileId);
      if (!current) {
        continue;
      }
      byId.set(match.fileId, {
        ...current,
        metadata: {
          ...mergeAccSheet(current.metadata, values),
          ...(versions.length > 0 ? { accVersions: versions } : {}),
        },
      });
      metadataAttached += 1;
    }
  }

  onProgress?.({
    resolved,
    total,
    currentPath: "",
    message: `Resolved ${resolved} of ${total} ACC links. Metadata on ${metadataAttached} files.`,
  });

  return {
    index: {
      ...index,
      items: index.items.map((item) => byId.get(item.id) ?? item),
    },
    resolved,
    missing,
    metadataAttached,
    metadataNote,
    attributeNames: [...attributeNames].sort((a, b) => a.localeCompare(b)),
    nameMatched,
    ambiguous,
  };
}

async function indexAccFilesByName(
  rootFolderId: string,
  rootFolderName: string,
  load: (folderId: string) => Promise<AccFolderContentItem[]>,
  onFolder?: (count: number) => void,
): Promise<Map<string, AccNamedFile[]>> {
  const byName = new Map<string, AccNamedFile[]>();
  const queue: Array<{ id: string; path: string }> = [{ id: rootFolderId, path: rootFolderName }];
  const seen = new Set<string>();
  let folders = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current.id)) {
      continue;
    }
    seen.add(current.id);
    folders += 1;
    onFolder?.(folders);
    const contents = await load(current.id);
    for (const item of contents) {
      if (item.type === "folders") {
        queue.push({ id: item.id, path: `${current.path}/${item.displayName}` });
        continue;
      }
      const key = normalizeSegment(item.displayName);
      if (key.length === 0) {
        continue;
      }
      const named: AccNamedFile = {
        name: item.displayName,
        entityId: item.id,
        folderUrn: current.id,
        folderPath: current.path,
        tipVersionId: item.tipVersionId,
        createUserName: item.createUserName,
        lastModifiedUserName: item.lastModifiedUserName,
        lastModifiedTime: item.lastModifiedTime,
      };
      const list = byName.get(key) ?? [];
      list.push(named);
      byName.set(key, list);
    }
  }
  return byName;
}
