import taxonomyJson from "@/metadata/taxonomy/accAcceleratorTaxonomy.json";

export interface AccTaxonomyItem {
  code: string;
  name?: string;
  program?: string;
  disciplineCode?: string;
  discipline?: string;
  subdisciplineCode?: string | null;
  subdiscipline?: string;
  notes?: string | null;
}

export interface AccTaxonomyLevel {
  id: "L1" | "L2" | "L3" | "L4" | "L5" | "L6" | "L7";
  key: string;
  label: string;
  sheet: string;
  items: AccTaxonomyItem[];
}

export interface AccTaxonomyBundle {
  version: string;
  source: string;
  levels: AccTaxonomyLevel[];
}

export const ACC_TAXONOMY = taxonomyJson as AccTaxonomyBundle;

export const ACC_TAXONOMY_LEVELS = ACC_TAXONOMY.levels;

/** Stable metadata keys written onto IndexNode.metadata */
export const ACC_METADATA_KEYS = ACC_TAXONOMY_LEVELS.map((level) => level.key);

/** True when a filename follows Accelerator naming: L-AC-… */
export function isAccAcceleratorNamed(fileName: string, relativePath = ""): boolean {
  const base = fileName.replace(/\.[^.]+$/i, "");
  if (/^L[-_]AC[-_]/i.test(base)) {
    return true;
  }
  if (/(^|[/\\])L-AC-/i.test(relativePath.replace(/\\/g, "/"))) {
    return true;
  }
  return false;
}

function hasAccSourceMetadata(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) {
    return false;
  }
  if (typeof metadata.accUrl === "string" && metadata.accUrl.length > 0) {
    return true;
  }
  if (typeof metadata.entityId === "string" && metadata.entityId.length > 0) {
    return true;
  }
  if (metadata.source === "acc") {
    return true;
  }
  for (const key of ACC_METADATA_KEYS) {
    for (const alias of METADATA_ALIASES[key] ?? [key]) {
      const value = metadata[alias];
      if (value !== undefined && value !== null && String(value).trim().length > 0) {
        return true;
      }
    }
  }
  return false;
}

/** True when the loaded index contains ACC / Accelerator content. */
export function indexShowsAccTaxonomy(index: { items: Array<{ nodeType: string; name: string; relativePath: string; metadata?: Record<string, unknown> }> } | null): boolean {
  if (!index) {
    return false;
  }
  for (const item of index.items) {
    if (item.nodeType !== "file") {
      continue;
    }
    if (isAccAcceleratorNamed(item.name, item.relativePath) || hasAccSourceMetadata(item.metadata)) {
      return true;
    }
  }
  return false;
}

const CODE_LOOKUPS: Record<string, Map<string, AccTaxonomyItem>> = Object.fromEntries(
  ACC_TAXONOMY_LEVELS.map((level) => [
    level.key,
    new Map(level.items.map((item) => [item.code.toUpperCase(), item])),
  ]),
);

const METADATA_ALIASES: Record<string, string[]> = {
  "ACC-Portfolio": ["ACC-Portfolio", "portfolio", "Portfolio", "L1", "L1 - Portfolio"],
  "ACC-Program": ["ACC-Program", "program", "Program", "L2", "L2 - Program"],
  "ACC-Sub Program": ["ACC-Sub Program", "subProgram", "Sub Program", "SubProgram", "L3", "L3 - Sub Program"],
  "ACC-Originator": ["ACC-Originator", "originator", "Originator", "L4", "L4 - Originator"],
  "ACC-Location": ["ACC-Location", "location", "Location", "projectLocation", "L5", "L5 - Location"],
  "ACC-Discipline": ["ACC-Discipline", "discipline", "Discipline", "L6", "L6 - Discipline"],
  "ACC-Document Type": [
    "ACC-Document Type",
    "documentType",
    "Document Type",
    "docType",
    "L7",
    "L7 - Document Type",
  ],
};

function readableAccName(raw: string): string {
  return raw
    .replace(/\(\s*Reserved\s*\)/gi, "")
    .replace(/\bReserved\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Full taxonomy name, with spaces kept. Codes are not included. */
export function formatAccLabel(raw: string, code?: string): string {
  const cleaned = readableAccName(raw);
  const dashParts = cleaned.split(/\s*[—–]\s*/);
  const namePart = dashParts.length >= 2 ? readableAccName(dashParts.slice(1).join("-")) : cleaned;
  if (namePart.length > 0 && namePart.toLowerCase() !== "null") {
    return namePart;
  }
  const fallback = code?.trim();
  return fallback && fallback.length > 0 ? fallback : "?";
}

function displayValue(item: AccTaxonomyItem): string {
  if (item.discipline) {
    const combined =
      item.subdiscipline && item.subdiscipline.toLowerCase() !== "general"
        ? `${item.discipline} — ${item.subdiscipline}`
        : item.discipline;
    const name = readableAccName(combined);
    if (name.length > 0) {
      return name;
    }
  }
  if (item.name && item.name.trim().toLowerCase() !== "null") {
    const name = readableAccName(item.name);
    if (name.length > 0) {
      return name;
    }
  }
  return item.code;
}

const STORED_CODE = /^([A-Za-z0-9]+)\s*\[/;

/** Resolve a stored code, `CODE [name]`, or plain name to the full parameter name. */
export function presentAccValue(levelKey: string, raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "(none)";
  }
  const direct = CODE_LOOKUPS[levelKey]?.get(trimmed.toUpperCase());
  if (direct) {
    return displayValue(direct);
  }
  const embedded = trimmed.match(STORED_CODE)?.[1];
  if (embedded) {
    const item = CODE_LOOKUPS[levelKey]?.get(embedded.toUpperCase());
    if (item) {
      return displayValue(item);
    }
  }
  return formatAccLabel(trimmed);
}

function readAlias(metadata: Record<string, unknown> | undefined, key: string): string | null {
  if (!metadata) {
    return null;
  }
  for (const alias of METADATA_ALIASES[key] ?? [key]) {
    const value = metadata[alias];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value).trim();
    }
  }
  return null;
}

function tokenizeFileName(fileName: string): string[] {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base
    .split(/[-_\s.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * Infer ACC taxonomy values from existing metadata and/or filename tokens.
 * Filename pattern (Accelerator): L-AC-AE-PD-F0326-ELE3-DRG-…
 */
export function inferAccTaxonomy(
  fileName: string,
  relativePath: string,
  existing?: Record<string, unknown>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const level of ACC_TAXONOMY_LEVELS) {
    const fromMeta = readAlias(existing, level.key);
    if (fromMeta) {
      result[level.key] = presentAccValue(level.key, fromMeta);
    }
  }

  const tokens = tokenizeFileName(fileName);
  const pathTokens = relativePath.split(/[\\/]+/).flatMap((part) => tokenizeFileName(part));
  const allTokens = [...tokens, ...pathTokens];

  // Positional decode when the leading token is the portfolio code.
  if (tokens.length >= 7) {
    const positional: Array<{ key: string; token: string }> = [
      { key: "ACC-Portfolio", token: tokens[0] },
      { key: "ACC-Program", token: tokens[1] },
      { key: "ACC-Sub Program", token: tokens[2] },
      { key: "ACC-Originator", token: tokens[3] },
      { key: "ACC-Location", token: tokens[4] },
      { key: "ACC-Discipline", token: tokens[5] },
      { key: "ACC-Document Type", token: tokens[6] },
    ];
    const portfolioHit = CODE_LOOKUPS["ACC-Portfolio"]?.has(positional[0].token.toUpperCase());
    if (portfolioHit) {
      for (const slot of positional) {
        if (result[slot.key]) {
          continue;
        }
        const item = CODE_LOOKUPS[slot.key]?.get(slot.token.toUpperCase());
        if (item) {
          result[slot.key] = displayValue(item);
        }
      }
    }
  }

  // Fallback: match any unused token against remaining level code tables (longer codes first).
  for (const level of ACC_TAXONOMY_LEVELS) {
    if (result[level.key]) {
      continue;
    }
    const lookup = CODE_LOOKUPS[level.key];
    if (!lookup) {
      continue;
    }
    const ranked = [...lookup.keys()].sort((a, b) => b.length - a.length);
    for (const token of allTokens) {
      const upper = token.toUpperCase();
      if (lookup.has(upper)) {
        result[level.key] = displayValue(lookup.get(upper)!);
        break;
      }
      // Discipline codes sometimes appear without the trailing digit in paths.
      const fuzzy = ranked.find((code) => code.startsWith(upper) && upper.length >= 3);
      if (fuzzy && level.key === "ACC-Discipline") {
        result[level.key] = displayValue(lookup.get(fuzzy)!);
        break;
      }
    }
  }

  return result;
}

export function mergeAccTaxonomyMetadata(
  metadata: Record<string, unknown> | undefined,
  fileName: string,
  relativePath: string,
): Record<string, unknown> | undefined {
  // Only tag ACC / Accelerator files — keep ordinary folders free of ACC categories.
  if (!isAccAcceleratorNamed(fileName, relativePath) && !hasAccSourceMetadata(metadata)) {
    return metadata;
  }
  const inferred = inferAccTaxonomy(fileName, relativePath, metadata);
  if (Object.keys(inferred).length === 0) {
    return metadata;
  }
  return { ...(metadata ?? {}), ...inferred };
}
