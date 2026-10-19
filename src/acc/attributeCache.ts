import { parseAccMetadataDocument } from "@/acc/metadataDocument";
import { stripProjectIdPrefix } from "@/acc/urls";
import { versionSizeFields, type AccVersionSize } from "@/acc/versions";
import type { FileIndex } from "@/data/types";
import { promoteAccAttributeKeys } from "@/metadata/accTaxonomy";

const DB_NAME = "prisma-acc";
const STORE = "attributes";
const RECORD_KEY = "default";
const LOCAL_KEY = "prisma.acc.attributes.v1";

/** ACC values saved for one file, including the columns returned by APS. */
export interface AccAttributeRecord {
  path: string;
  name: string;
  metadata: Record<string, unknown>;
  versions?: AccVersionSize[];
}

export interface AccAttributeCache {
  projectId: string;
  folderName: string;
  savedAt: string;
  files: AccAttributeRecord[];
}

interface AccAttributeLibrary {
  defaults: AccAttributeCache[];
}

let current: AccAttributeLibrary | null = readLocalLibrary();

export function currentAccAttributeCache(): AccAttributeLibrary | null {
  return current;
}

export function accAttributeRecords(index: FileIndex): AccAttributeRecord[] {
  const records: AccAttributeRecord[] = [];
  for (const item of index.items) {
    if (item.nodeType !== "file" || !item.metadata) {
      continue;
    }
    const versions = versionList(item.metadata.accVersions);
    const metadata: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(item.metadata)) {
      if (key === "accVersions") {
        continue;
      }
      metadata[key] = value;
    }
    if (Object.keys(metadata).length === 0 && !versions) {
      continue;
    }
    records.push({
      path: item.relativePath,
      name: item.name,
      metadata,
      ...(versions ? { versions } : {}),
    });
  }
  return records;
}

export function mergeAttributeRecords(
  previous: readonly AccAttributeRecord[],
  next: readonly AccAttributeRecord[],
): AccAttributeRecord[] {
  const byPath = new Map<string, AccAttributeRecord>();
  for (const record of previous) {
    byPath.set(record.path.trim().toLowerCase(), record);
  }
  for (const record of next) {
    byPath.set(record.path.trim().toLowerCase(), record);
  }
  return [...byPath.values()];
}

/** Keep every saved column. A later read replaces a value, and a missing column stays. */
export function unionAttributeRecords(
  previous: readonly AccAttributeRecord[],
  next: readonly AccAttributeRecord[],
): AccAttributeRecord[] {
  const byPath = new Map<string, AccAttributeRecord>();
  for (const record of previous) {
    byPath.set(record.path.trim().toLowerCase(), record);
  }
  for (const record of next) {
    const key = record.path.trim().toLowerCase();
    const prior = byPath.get(key);
    if (!prior) {
      byPath.set(key, record);
      continue;
    }
    byPath.set(key, {
      path: record.path || prior.path,
      name: record.name || prior.name,
      metadata: { ...prior.metadata, ...record.metadata },
      versions: record.versions ?? prior.versions,
    });
  }
  return [...byPath.values()];
}

function sameText(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function projectKey(projectId: string): string {
  return stripProjectIdPrefix(projectId).toLowerCase();
}

function versionList(value: unknown): AccVersionSize[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const versions = value.filter((entry): entry is AccVersionSize => {
    if (!entry || typeof entry !== "object") {
      return false;
    }
    const version = entry as AccVersionSize;
    return typeof version.version === "number" && typeof version.bytes === "number" && typeof version.size === "string";
  });
  return versions.length > 0 ? versions : undefined;
}

/** Replace the saved default for this folder and project with the latest Resolve ACC read. */
export function upsertAccAttributeDefault(
  library: AccAttributeLibrary | null,
  projectId: string,
  index: FileIndex,
  savedAt: string,
): { library: AccAttributeLibrary; saved: number } {
  const incoming = accAttributeRecords(index);
  const project = stripProjectIdPrefix(projectId);
  const folderName = index.root?.name?.trim() ?? "";
  if (incoming.length === 0 || !project || !folderName) {
    return { library: library ?? { defaults: [] }, saved: 0 };
  }
  const previous = library?.defaults.find(
    (entry) => projectKey(entry.projectId) === projectKey(project) && sameText(entry.folderName, folderName),
  );
  const nextEntry: AccAttributeCache = {
    projectId: project,
    folderName,
    savedAt,
    files: mergeAttributeRecords(previous?.files ?? [], incoming),
  };
  const defaults = (library?.defaults ?? []).filter(
    (entry) => !(projectKey(entry.projectId) === projectKey(project) && sameText(entry.folderName, folderName)),
  );
  defaults.push(nextEntry);
  return { library: { defaults }, saved: incoming.length };
}

/**
 * Use the Resolve ACC JSON saved for this folder and project.
 * A different folder, or a different project, keeps its own files untouched.
 */
export function applySavedAccAttributes(
  index: FileIndex,
  settingsProjectId: string,
  library: AccAttributeLibrary | null = current,
): { index: FileIndex; applied: number } {
  const project = projectKey(settingsProjectId);
  const folderName = index.root?.name?.trim() ?? "";
  if (!library || !project || !folderName) {
    return { index, applied: 0 };
  }
  const match = savedDefaultFor(library, project, folderName, index);
  if (!match) {
    return { index, applied: 0 };
  }
  return applyAccAttributeRecords(index, match.files, match.projectId, project);
}

function savedDefaultFor(
  library: AccAttributeLibrary,
  project: string,
  folderName: string,
  index: FileIndex,
): AccAttributeCache | undefined {
  const entries = library.defaults.filter((entry) => projectKey(entry.projectId) === project);
  const exact = entries.find((entry) => sameText(entry.folderName, folderName));
  if (exact) {
    return exact;
  }
  const names = new Set(
    index.items.filter((item) => item.nodeType === "file").map((item) => item.name.trim().toLowerCase()),
  );
  const legacy = entries.find((entry) => {
    if (entry.folderName.trim().length > 0) {
      return false;
    }
    return entry.files.some((file) => names.has(file.name.trim().toLowerCase()));
  });
  if (legacy) {
    return legacy;
  }
  let best: { entry: AccAttributeCache; score: number } | undefined;
  for (const entry of entries) {
    const score = entry.files.filter((file) => names.has(file.name.trim().toLowerCase())).length;
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }
  if (best && best.score >= 3 && names.size > 0 && best.score >= Math.ceil(names.size / 2)) {
    return best.entry;
  }
  return undefined;
}

/**
 * Copy saved ACC values onto files in a newly loaded folder.
 * A full path wins. A file name is used only when that name was saved once.
 */
export function applyAccAttributeRecords(
  index: FileIndex,
  records: readonly AccAttributeRecord[],
  cacheProjectId: string,
  settingsProjectId: string,
): { index: FileIndex; applied: number } {
  const cacheProject = projectKey(cacheProjectId);
  const settingsProject = projectKey(settingsProjectId);
  if (records.length === 0 || (cacheProject && settingsProject && cacheProject !== settingsProject)) {
    return { index, applied: 0 };
  }
  const byPath = new Map<string, AccAttributeRecord[]>();
  const byName = new Map<string, AccAttributeRecord[]>();
  for (const record of records) {
    const pathKey = record.path.trim().toLowerCase();
    const nameKey = record.name.trim().toLowerCase();
    byPath.set(pathKey, [...(byPath.get(pathKey) ?? []), record]);
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), record]);
  }
  let applied = 0;
  const items = index.items.map((item) => {
    if (item.nodeType !== "file") {
      return item;
    }
    const pathHit = byPath.get(item.relativePath.trim().toLowerCase())?.[0];
    const nameHits = byName.get(item.name.trim().toLowerCase()) ?? [];
    const hit = pathHit ?? (nameHits.length === 1 ? nameHits[0] : undefined);
    if (!hit) {
      return item;
    }
    const versions = hit.versions ?? versionList(hit.metadata.accVersions);
    applied += 1;
    return {
      ...item,
      metadata: {
        ...promoteAccAttributeKeys({
          ...(item.metadata ?? {}),
          ...hit.metadata,
          ...(versions ? versionSizeFields(versions) : {}),
        }),
        ...(versions ? { accVersions: versions } : {}),
      },
    };
  });
  if (applied === 0) {
    return { index, applied: 0 };
  }
  return { index: { ...index, items }, applied };
}

export async function loadAccAttributeCache(): Promise<AccAttributeLibrary | null> {
  if (typeof indexedDB === "undefined") {
    return current;
  }
  const database = await openDatabase();
  const stored = await getRecord(database);
  database.close();
  current = mergeLibraries(current, stored);
  if (current) {
    writeLocalLibrary(current);
  }
  return current;
}

function mergeLibraries(left: AccAttributeLibrary | null, right: AccAttributeLibrary | null): AccAttributeLibrary | null {
  const byKey = new Map<string, AccAttributeCache>();
  for (const entry of [...(left?.defaults ?? []), ...(right?.defaults ?? [])]) {
    const key = `${projectKey(entry.projectId)}|${entry.folderName.trim().toLowerCase()}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeCacheEntries(existing, entry) : entry);
  }
  if (byKey.size === 0) {
    return left ?? right;
  }
  return { defaults: [...byKey.values()] };
}

function mergeCacheEntries(left: AccAttributeCache, right: AccAttributeCache): AccAttributeCache {
  const newer = right.savedAt >= left.savedAt ? right : left;
  const older = newer === right ? left : right;
  return {
    projectId: newer.projectId || older.projectId,
    folderName: newer.folderName || older.folderName,
    savedAt: newer.savedAt || older.savedAt,
    files: unionAttributeRecords(older.files, newer.files),
  };
}

/** Keep a downloaded `{folder}.acc-metadata.json` as the default for that folder and its project. */
export function rememberAccMetadataDocument(document: unknown, folderName: string, savedAt: string): number {
  const parsed = parseAccMetadataDocument(document);
  const folder = folderName.trim();
  if (!parsed || !folder) {
    return 0;
  }
  const entry: AccAttributeCache = {
    projectId: parsed.projectId,
    folderName: folder,
    savedAt,
    files: parsed.files,
  };
  current = mergeLibraries(current, { defaults: [entry] });
  if (current) {
    writeLocalLibrary(current);
  }
  return parsed.files.length;
}

function readLocalLibrary(): AccAttributeLibrary | null {
  if (typeof localStorage === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) {
      return null;
    }
    return libraryFromStored(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeLocalLibrary(library: AccAttributeLibrary): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(library));
  } catch {
    // The IndexedDB copy remains the fallback when the browser quota is full.
  }
}

/** Remember the Resolve ACC JSON as the default for this folder and project. */
export async function saveAccAttributeCache(projectId: string, index: FileIndex): Promise<number> {
  const next = upsertAccAttributeDefault(current, projectId, index, new Date().toISOString());
  if (next.saved === 0) {
    return 0;
  }
  current = next.library;
  writeLocalLibrary(current);
  if (typeof indexedDB === "undefined") {
    return next.saved;
  }
  const database = await openDatabase();
  await putRecord(database, current);
  database.close();
  return next.saved;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the local ACC attribute store"));
  });
}

function getRecord(database: IDBDatabase): Promise<AccAttributeLibrary | null> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).get(RECORD_KEY);
    request.onsuccess = () => {
      resolve(libraryFromStored(request.result));
    };
    request.onerror = () => reject(request.error ?? new Error("Could not read saved ACC attributes"));
  });
}

function libraryFromStored(value: unknown): AccAttributeLibrary | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { defaults?: unknown; files?: unknown; projectId?: unknown; folderName?: unknown; savedAt?: unknown };
  if (Array.isArray(record.defaults)) {
    return { defaults: record.defaults as AccAttributeCache[] };
  }
  if (Array.isArray(record.files) && typeof record.projectId === "string") {
    return {
      defaults: [
        {
          projectId: record.projectId,
          folderName: typeof record.folderName === "string" ? record.folderName : "",
          savedAt: typeof record.savedAt === "string" ? record.savedAt : "",
          files: record.files as AccAttributeRecord[],
        },
      ],
    };
  }
  return null;
}

function putRecord(database: IDBDatabase, cache: AccAttributeLibrary): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, "readwrite").objectStore(STORE).put(cache, RECORD_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Could not save ACC attributes"));
  });
}
