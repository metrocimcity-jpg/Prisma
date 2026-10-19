import { versionFromTipUrn } from "@/acc/attributes";
import { formatBytes } from "@/utils/format";

export interface AccVersionSize {
  version: number;
  bytes: number;
  size: string;
}

interface AccRawVersion {
  id?: string;
  attributes?: {
    versionNumber?: number | string;
    storageSize?: number | string;
  };
}

function wholeNumber(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Version number and byte size for each ACC file version, oldest first. */
export function versionSizesFromNodes(nodes: readonly AccRawVersion[]): AccVersionSize[] {
  const byVersion = new Map<number, AccVersionSize>();
  for (const node of nodes) {
    const fromAttribute = wholeNumber(node.attributes?.versionNumber);
    const fromUrn = wholeNumber(versionFromTipUrn(node.id) ?? undefined);
    const version = fromAttribute ?? fromUrn;
    const bytes = wholeNumber(node.attributes?.storageSize);
    if (version === null || version < 1 || bytes === null || bytes < 0) {
      continue;
    }
    byVersion.set(version, {
      version,
      bytes,
      size: formatBytes(bytes),
    });
  }
  return [...byVersion.values()].sort((a, b) => a.version - b.version);
}

/** One field per version, plus a single list such as `1: 2.0 MB, 2: 4.0 MB, 3: 12 MB`. */
export function versionSizeFields(versions: readonly AccVersionSize[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const entry of versions) {
    values[`Version ${entry.version} size`] = entry.size;
  }
  if (versions.length > 0) {
    values["Version sizes"] = versions.map((entry) => `${entry.version}: ${entry.size}`).join(", ");
  }
  return values;
}
