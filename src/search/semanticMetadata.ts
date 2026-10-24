import type { FileIndex } from "@/data/types";
import {
  ACC_METADATA_KEYS,
  abbreviateAccValue,
  canonicalAccMetadataKey,
  presentAccValue,
} from "@/metadata/accTaxonomy";
import type { MetadataFilter, SemanticIntent } from "@/search/semanticIntent";

export interface MetadataCatalogEntry {
  key: string;
  raw: string;
  code: string;
  label: string;
  compact: string;
}

const FIELD_CUES: Array<{ match: RegExp; keys: string[] }> = [
  { match: /\bdisciplines?\b/, keys: ["ACC-Discipline", "discipline"] },
  { match: /\blocations?\b/, keys: ["ACC-Location", "location", "projectLocation"] },
  { match: /\b(?:document\s+types?|doc\s*types?)\b/, keys: ["ACC-Document Type", "documentType"] },
  { match: /\bportfolios?\b/, keys: ["ACC-Portfolio", "portfolio"] },
  { match: /\bprograms?\b/, keys: ["ACC-Program", "program"] },
  { match: /\bsub[\s-]?programs?\b/, keys: ["ACC-Sub Program", "subProgram"] },
  { match: /\boriginators?\b/, keys: ["ACC-Originator", "originator"] },
];

/** Spoken synonyms → ACC document-type / discipline family cues. */
const VALUE_SYNONYMS: Array<{ match: RegExp; keys: string[]; needles: string[] }> = [
  { match: /\bdrawings?\b|\bdrgs?\b/, keys: ["ACC-Document Type"], needles: ["drg", "drawing"] },
  { match: /\bm3d\b|\b3d\s+models?\b|\bmodel-3d\b/, keys: ["ACC-Document Type"], needles: ["m3d", "model-3d"] },
  { match: /\bm2d\b|\b2d\s+models?\b|\bmodel-2d\b/, keys: ["ACC-Document Type"], needles: ["m2d", "2dmodels"] },
  { match: /\bsubmittals?\b/, keys: ["ACC-Document Type"], needles: ["sub", "submittal"] },
  { match: /\breports?\b/, keys: ["ACC-Document Type"], needles: ["rpt", "report"] },
  { match: /\bschedule\b/, keys: ["ACC-Document Type"], needles: ["sch", "schedule"] },
  { match: /\bspec(?:ification)?s?\b/, keys: ["ACC-Document Type"], needles: ["spc", "specification"] },
  {
    match: /\belectrical\b/,
    keys: ["ACC-Discipline", "discipline"],
    needles: ["ele", "electrical", "emergency power"],
  },
  {
    match: /\bairfield\s+electrical\b|\baes\b/,
    keys: ["ACC-Discipline", "discipline"],
    needles: ["aes", "airfieldelectrical"],
  },
  {
    match: /\bpavement\b|\bape\b/,
    keys: ["ACC-Discipline", "discipline"],
    needles: ["ape", "pavement"],
  },
  {
    match: /\bcivil\b|\bciv\b/,
    keys: ["ACC-Discipline", "discipline"],
    needles: ["civ", "civil"],
  },
  {
    match: /\bstorm(?:water)?\b|\bdrainage\b|\bsmd\b/,
    keys: ["ACC-Discipline", "discipline"],
    needles: ["smd", "stormwater", "drainage"],
  },
  {
    match: /\brunway\b|\barw\b/,
    keys: ["ACC-Location", "location"],
    needles: ["arw", "runway"],
  },
  {
    match: /\btaxiways?\b/,
    keys: ["ACC-Location", "location"],
    needles: ["aastw", "taxiway"],
  },
  {
    match: /\bairside\b/,
    keys: ["ACC-Location", "location"],
    needles: ["aasgn", "airside"],
  },
  {
    match: /\bairport\s*wide\b|\bairportwide\b/,
    keys: ["ACC-Location", "location"],
    needles: ["fapgn", "airportwide"],
  },
];

/**
 * Collect unique metadata values from a loaded JSON index (ACC fields from AE.index.json, etc.).
 */
export function buildMetadataCatalog(index: FileIndex): MetadataCatalogEntry[] {
  const seen = new Set<string>();
  const entries: MetadataCatalogEntry[] = [];
  for (const item of index.items) {
    if (item.nodeType !== "file" || !item.metadata) {
      continue;
    }
    for (const [key, rawValue] of Object.entries(item.metadata)) {
      if (rawValue === null || rawValue === undefined) {
        continue;
      }
      const raw = String(rawValue).trim();
      if (!raw) {
        continue;
      }
      const id = `${key.toLowerCase()}::${raw.toLowerCase()}`;
      if (seen.has(id)) {
        continue;
      }
      seen.add(id);
      const canonical = canonicalAccMetadataKey(key) ?? key;
      const code = extractCode(raw, canonical);
      const label = humanLabel(raw, canonical);
      entries.push({
        key: canonical,
        raw,
        code,
        label,
        compact: compactText(`${code} ${label} ${raw}`),
      });
    }
  }
  return entries;
}

/** Expand spoken / typed asks with hard filters against the index metadata catalog. */
export function enrichIntentWithIndexMetadata(intent: SemanticIntent, index: FileIndex, ask: string): SemanticIntent {
  const catalog = buildMetadataCatalog(index);
  if (catalog.length === 0) {
    return intent;
  }

  const text = normalizeAsk(ask);
  const filters = [...intent.metadataFilters];
  const matchedByKey = new Map<string, Set<string>>();

  const remember = (key: string, raw: string): void => {
    const canonical = canonicalAccMetadataKey(key) ?? key;
    const set = matchedByKey.get(canonical) ?? new Set<string>();
    set.add(raw);
    matchedByKey.set(canonical, set);
  };

  // Explicit codes in the ask (ELE7, ARW05, M3D, DRG, …).
  for (const entry of catalog) {
    if (entry.code.length >= 2 && new RegExp(`\\b${escapeRegExp(entry.code)}\\b`, "i").test(text)) {
      remember(entry.key, entry.raw);
    }
  }

  // Field cue + following words, e.g. "discipline electrical", "location runway 05".
  for (const cue of FIELD_CUES) {
    if (!cue.match.test(text)) {
      continue;
    }
    const scoped = catalog.filter((entry) => cue.keys.some((key) => sameMetaKey(key, entry.key)));
    for (const entry of scoped) {
      if (entryMatchesAsk(entry, text)) {
        remember(entry.key, entry.raw);
      }
    }
  }

  // Synonym families (drawings → DRG, electrical → ELE*, runway → ARW*).
  for (const synonym of VALUE_SYNONYMS) {
    if (!synonym.match.test(text)) {
      continue;
    }
    for (const entry of catalog) {
      if (!synonym.keys.some((key) => sameMetaKey(key, entry.key))) {
        continue;
      }
      if (synonym.needles.some((needle) => entry.compact.includes(compactText(needle)) || entry.code.toLowerCase().startsWith(needle.toLowerCase()))) {
        remember(entry.key, entry.raw);
      }
    }
  }

  // Multi-word label hits (e.g. "airfield pavement engineering").
  for (const entry of catalog) {
    if (labelPhraseMatchesAsk(entry, text)) {
      remember(entry.key, entry.raw);
    }
  }

  for (const [key, values] of matchedByKey) {
    pushFilter(filters, metaKeyAliases(key), [...values]);
  }

  // Soft location phrases like "airfield" → ACC-Location / ACC-Sub Program when present in catalog.
  if (intent.locations.length > 0) {
    for (const location of intent.locations) {
      const needle = compactText(location);
      if (needle.length < 4) {
        continue;
      }
      const hits = catalog.filter(
        (entry) =>
          (sameMetaKey(entry.key, "ACC-Location") || sameMetaKey(entry.key, "ACC-Sub Program")) &&
          entry.compact.includes(needle),
      );
      if (hits.length > 0) {
        pushFilter(
          filters,
          metaKeyAliases(hits[0].key),
          hits.map((hit) => hit.raw),
        );
      }
    }
  }

  if (filters.length === intent.metadataFilters.length) {
    return intent;
  }

  return {
    ...intent,
    metadataFilters: filters,
    wantAll: intent.wantAll || filters.length > intent.metadataFilters.length,
  };
}

export function metaKeyAliases(key: string): string[] {
  const canonical = canonicalAccMetadataKey(key) ?? key;
  const aliases = new Set<string>([key, canonical]);
  for (const known of ACC_METADATA_KEYS) {
    if (known.toLowerCase() === canonical.toLowerCase()) {
      aliases.add(known);
    }
  }
  // Common short aliases used in sample JSON and spoken asks.
  if (canonical === "ACC-Discipline") {
    aliases.add("discipline");
    aliases.add("Discipline");
  } else if (canonical === "ACC-Location") {
    aliases.add("location");
    aliases.add("projectLocation");
  } else if (canonical === "ACC-Document Type") {
    aliases.add("documentType");
    aliases.add("docType");
  } else if (canonical === "ACC-Program") {
    aliases.add("program");
  } else if (canonical === "ACC-Sub Program") {
    aliases.add("subProgram");
  } else if (canonical === "ACC-Portfolio") {
    aliases.add("portfolio");
  } else if (canonical === "ACC-Originator") {
    aliases.add("originator");
  }
  return [...aliases];
}

function entryMatchesAsk(entry: MetadataCatalogEntry, ask: string): boolean {
  if (entry.code.length >= 2 && new RegExp(`\\b${escapeRegExp(entry.code)}\\b`, "i").test(ask)) {
    return true;
  }
  return labelPhraseMatchesAsk(entry, ask);
}

function labelPhraseMatchesAsk(entry: MetadataCatalogEntry, ask: string): boolean {
  const label = entry.label.toLowerCase();
  if (label.length >= 10 && ask.includes(label)) {
    return true;
  }
  const words = label.split(/[^a-z0-9]+/).filter((word) => word.length >= 5);
  if (words.length >= 2 && words.filter((word) => ask.includes(word)).length >= 2) {
    return true;
  }
  return false;
}

function extractCode(raw: string, key: string): string {
  const embedded = raw.match(/^([A-Za-z0-9]+)\s*\[/);
  if (embedded) {
    return embedded[1].toUpperCase();
  }
  try {
    return abbreviateAccValue(key, raw).toUpperCase();
  } catch {
    return raw.split(/\s+/)[0]?.toUpperCase() ?? raw.toUpperCase();
  }
}

function humanLabel(raw: string, key: string): string {
  try {
    const presented = presentAccValue(key, raw);
    if (presented && presented !== "(none)") {
      return presented;
    }
  } catch {
    // Taxonomy may not know this key; fall through.
  }
  const bracket = raw.match(/\[([^\]]+)\]/);
  if (bracket) {
    return splitCamel(bracket[1]);
  }
  return raw;
}

function splitCamel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAsk(ask: string): string {
  return ask.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

function compactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function sameMetaKey(left: string, right: string): boolean {
  const a = canonicalAccMetadataKey(left) ?? left;
  const b = canonicalAccMetadataKey(right) ?? right;
  return a.toLowerCase() === b.toLowerCase();
}

function pushFilter(target: MetadataFilter[], keys: string[], values: string[]): void {
  const normalizedKeys = [...new Set(keys.map((key) => key.trim()).filter(Boolean))];
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (normalizedKeys.length === 0 || normalizedValues.length === 0) {
    return;
  }
  const existing = target.find((filter) => filter.keys.some((key) => normalizedKeys.some((item) => sameMetaKey(key, item))));
  if (existing) {
    for (const key of normalizedKeys) {
      if (!existing.keys.some((item) => item.toLowerCase() === key.toLowerCase())) {
        existing.keys.push(key);
      }
    }
    for (const value of normalizedValues) {
      if (!existing.values.some((item) => item.toLowerCase() === value.toLowerCase())) {
        existing.values.push(value);
      }
    }
    return;
  }
  target.push({ keys: normalizedKeys, values: normalizedValues });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
