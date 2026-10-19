import { parseAccProjectIdFromUrl } from "@/acc/urls";
import type { AccVersionSize } from "@/acc/versions";

/** One file inside the JSON that Resolve ACC downloads. */
export interface AccMetadataDocumentRecord {
  path: string;
  name: string;
  metadata: Record<string, unknown>;
  versions?: AccVersionSize[];
}

export interface AccMetadataDocument {
  projectId: string;
  files: AccMetadataDocumentRecord[];
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

/**
 * Read the JSON Resolve ACC downloads (`{folder}.acc-metadata.json`).
 * A Prisma index or workspace file is left alone.
 */
export function parseAccMetadataDocument(value: unknown): AccMetadataDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { files?: unknown; schemaVersion?: unknown; root?: unknown };
  if (record.schemaVersion !== undefined || record.root !== undefined || !Array.isArray(record.files)) {
    return null;
  }
  const files: AccMetadataDocumentRecord[] = [];
  let projectId = "";
  for (const item of record.files) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const file = item as { path?: unknown; name?: unknown; metadata?: unknown; versions?: unknown };
    const name = typeof file.name === "string" ? file.name.trim() : "";
    const path = typeof file.path === "string" && file.path.trim().length > 0 ? file.path.trim() : name;
    if (!path) {
      continue;
    }
    const metadata =
      file.metadata && typeof file.metadata === "object" && !Array.isArray(file.metadata)
        ? { ...(file.metadata as Record<string, unknown>) }
        : {};
    const versions = versionList(file.versions);
    if (!projectId && typeof metadata.accUrl === "string") {
      projectId = parseAccProjectIdFromUrl(metadata.accUrl) ?? "";
    }
    if (Object.keys(metadata).length === 0 && !versions) {
      continue;
    }
    files.push({
      path,
      name: name || path.split("/").pop() || path,
      metadata,
      ...(versions ? { versions } : {}),
    });
  }
  if (!projectId || files.length === 0) {
    return null;
  }
  return { projectId, files };
}
