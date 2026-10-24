/**
 * Turns a human sentence into structured intent for ranking files from a JSON index.
 * Example: "all revit models for airfield location for last month"
 */

export type SizeBand = "tiny" | "small" | "medium" | "large" | "huge";
/** `around` = about N days ago. `within` = modified in the last N days. */
export type AgeMode = "around" | "within";

export interface SemanticIntent {
  raw: string;
  /** Prefer every matching file, not a single favorite. */
  wantAll: boolean;
  keywords: string[];
  extensions: string[];
  categories: string[];
  pathHints: string[];
  locations: string[];
  disciplines: string[];
  documentTypes: string[];
  sizeBand: SizeBand | null;
  sizeMaxBytes: number | null;
  sizeMinBytes: number | null;
  ageMode: AgeMode | null;
  /** Days: center for `around`, maximum age for `within`. */
  ageDays: number | null;
  ageToleranceDays: number;
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "for",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "from",
  "with",
  "and",
  "or",
  "it",
  "is",
  "are",
  "was",
  "were",
  "be",
  "that",
  "this",
  "those",
  "these",
  "please",
  "find",
  "show",
  "get",
  "me",
  "my",
  "our",
  "all",
  "every",
  "any",
  "file",
  "files",
  "model",
  "models",
  "document",
  "documents",
  "ago",
  "about",
  "around",
  "roughly",
  "approximately",
  "last",
  "past",
  "over",
  "under",
]);

const EXTENSION_ALIASES: Array<{ match: RegExp; ext: string }> = [
  { match: /\brevit\b|\.rvt\b|\brvt\b/, ext: "rvt" },
  { match: /\bautodesk\s+family\b|\.rfa\b|\brfa\b/, ext: "rfa" },
  { match: /\btemplate\b.*\brevit\b|\.rte\b|\brte\b/, ext: "rte" },
  { match: /\bifc\b|\.ifc\b/, ext: "ifc" },
  { match: /\bnavisworks\b|\.nwd\b|\bnwd\b/, ext: "nwd" },
  { match: /\.nwc\b|\bnwc\b/, ext: "nwc" },
  { match: /\bautocad\b|\bdwg\b|\.dwg\b/, ext: "dwg" },
  { match: /\bdxf\b|\.dxf\b/, ext: "dxf" },
  { match: /\bpdf\b|\.pdf\b/, ext: "pdf" },
  { match: /\bexcel\b|\bxlsx\b|\.xlsx\b/, ext: "xlsx" },
  { match: /\bword\b|\bdocx\b|\.docx\b/, ext: "docx" },
  { match: /\bpng\b|\.png\b/, ext: "png" },
  { match: /\bjpg\b|\bjpeg\b|\.jpe?g\b/, ext: "jpg" },
  { match: /\bmp4\b|\.mp4\b|video\s+file/, ext: "mp4" },
];

const CATEGORY_ALIASES: Array<{ match: RegExp; category: string; pathHint?: string }> = [
  { match: /\barchitectur(?:e|al)\b/, category: "BIM", pathHint: "Architecture" },
  { match: /\bstructure\b|\bstructural\b/, category: "BIM", pathHint: "Structure" },
  { match: /\bmep\b|\bmechanical\b|\belectrical\b|\bplumbing\b/, category: "BIM", pathHint: "MEP" },
  { match: /\bbim\b/, category: "BIM" },
  { match: /\bcad\b|\bcivil\b/, category: "CAD" },
  { match: /\bgis\b|\bsurvey\b/, category: "GIS" },
  { match: /\bimage\b|\bpicture\b|\brender\b/, category: "Images" },
  { match: /\bvideo\b|\banimation\b/, category: "Video" },
  { match: /\bpdf\b|\breport\b/, category: "PDF" },
  { match: /\barchive\b|\bzip\b/, category: "Archives" },
];

const DISCIPLINE_ALIASES: Array<{ match: RegExp; value: string }> = [
  { match: /\barchitectur(?:e|al)\b/, value: "ARCH" },
  { match: /\bstructure\b|\bstructural\b/, value: "STR" },
  { match: /\bmep\b/, value: "MEP" },
  { match: /\belectrical\b/, value: "ELEO" },
];

const LOCATION_PHRASES = [
  "airfield",
  "airport",
  "harbor",
  "harbour",
  "bridge",
  "terminal",
  "fec a",
  "fec b",
  "fec c",
  "site",
];

const MB = 1024 ** 2;
const GB = 1024 ** 3;

export function parseSemanticIntent(input: string): SemanticIntent {
  const raw = input.trim();
  const text = raw.toLowerCase().replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();

  const extensions: string[] = [];
  for (const alias of EXTENSION_ALIASES) {
    if (alias.match.test(text) && !extensions.includes(alias.ext)) {
      extensions.push(alias.ext);
    }
  }

  const categories: string[] = [];
  const pathHints: string[] = [];
  for (const alias of CATEGORY_ALIASES) {
    if (alias.match.test(text)) {
      if (!categories.includes(alias.category)) {
        categories.push(alias.category);
      }
      if (alias.pathHint && !pathHints.includes(alias.pathHint)) {
        pathHints.push(alias.pathHint);
      }
    }
  }

  const disciplines: string[] = [];
  for (const alias of DISCIPLINE_ALIASES) {
    if (alias.match.test(text) && !disciplines.includes(alias.value)) {
      disciplines.push(alias.value);
    }
  }

  const locations: string[] = [];
  for (const phrase of LOCATION_PHRASES) {
    if (text.includes(phrase) && !locations.includes(phrase)) {
      locations.push(phrase);
    }
  }
  const locationMatch = text.match(/\blocation\s+([a-z0-9][a-z0-9 -]{0,40})/);
  if (locationMatch) {
    const value = locationMatch[1].trim();
    if (value && !locations.includes(value)) {
      locations.push(value);
    }
  }

  const documentTypes: string[] = [];
  if (/\bmodel\b|\bm3d\b/.test(text)) {
    documentTypes.push("M3D");
  }

  const age = parseAgeDays(text);
  const size = parseSizeBand(text);

  const covered = new Set<string>([
    ...extensions,
    ...categories.map((item) => item.toLowerCase()),
    ...pathHints.map((item) => item.toLowerCase()),
    ...locations.flatMap((item) => item.split(" ")),
    "revit",
    "autodesk",
    "autocad",
    "navisworks",
    "architectural",
    "architecture",
    "structural",
    "structure",
    "location",
    "locations",
    "week",
    "weeks",
    "day",
    "days",
    "month",
    "months",
    "year",
    "years",
    "small",
    "large",
    "tiny",
    "huge",
    "medium",
    "big",
    "little",
    "light",
    "heavy",
  ]);

  const keywords = text
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP.has(token) && !/^\d+(\.\d+)?$/.test(token))
    .filter((token) => !covered.has(token.replace(/^\./, "")));

  return {
    raw,
    wantAll: /\b(?:all|every|each)\b/.test(text),
    keywords: unique(keywords),
    extensions,
    categories,
    pathHints,
    locations,
    disciplines,
    documentTypes,
    sizeBand: size.band,
    sizeMaxBytes: size.max,
    sizeMinBytes: size.min,
    ageMode: age.mode,
    ageDays: age.days,
    ageToleranceDays: age.tolerance,
  };
}

function parseAgeDays(text: string): { mode: AgeMode | null; days: number | null; tolerance: number } {
  if (/\blast\s+month\b|\bpast\s+month\b|\bin\s+the\s+last\s+month\b/.test(text)) {
    return { mode: "within", days: 30, tolerance: 0 };
  }
  if (/\blast\s+week\b|\bpast\s+week\b|\bin\s+the\s+last\s+week\b/.test(text)) {
    return { mode: "within", days: 7, tolerance: 0 };
  }
  if (/\btoday\b|\bjust\s+now\b/.test(text)) {
    return { mode: "within", days: 1, tolerance: 0 };
  }
  if (/\byesterday\b/.test(text)) {
    return { mode: "around", days: 1, tolerance: 1 };
  }
  const within = text.match(/(?:in\s+the\s+)?(?:last|past)\s+(\d+)\s*(days?|weeks?|months?)/);
  if (within) {
    const amount = Number(within[1]);
    const unit = within[2];
    const days = unit.startsWith("week") ? amount * 7 : unit.startsWith("month") ? amount * 30 : amount;
    return { mode: "within", days, tolerance: 0 };
  }
  const weeks = text.match(/(\d+)\s*weeks?\s+ago/);
  if (weeks) {
    const days = Number(weeks[1]) * 7;
    return { mode: "around", days, tolerance: Math.max(5, Math.round(days * 0.4)) };
  }
  const days = text.match(/(\d+)\s*days?\s+ago/);
  if (days) {
    const value = Number(days[1]);
    return { mode: "around", days: value, tolerance: Math.max(3, Math.round(value * 0.4)) };
  }
  const months = text.match(/(\d+)\s*months?\s+ago/);
  if (months) {
    const value = Number(months[1]) * 30;
    return { mode: "around", days: value, tolerance: Math.max(10, Math.round(value * 0.35)) };
  }
  return { mode: null, days: null, tolerance: 7 };
}

function parseSizeBand(text: string): { band: SizeBand | null; min: number | null; max: number | null } {
  if (/\btiny\b|\bvery\s+small\b/.test(text)) {
    return { band: "tiny", min: null, max: 2 * MB };
  }
  if (/\bsmall\b|\blittle\b|\blight\b/.test(text)) {
    return { band: "small", min: null, max: 50 * MB };
  }
  if (/\bmedium\b|\baverage\b/.test(text)) {
    return { band: "medium", min: 20 * MB, max: 200 * MB };
  }
  if (/\bhuge\b|\benormous\b|\bmassive\b/.test(text)) {
    return { band: "huge", min: 500 * MB, max: null };
  }
  if (/\blarge\b|\bbig\b|\bheavy\b/.test(text)) {
    return { band: "large", min: 100 * MB, max: null };
  }
  const under = text.match(/(?:under|less\s+than|smaller\s+than|<)\s*(\d+(?:\.\d+)?)\s*(kb|mb|gb)/);
  if (under) {
    return { band: "small", min: null, max: toBytes(Number(under[1]), under[2]) };
  }
  const over = text.match(/(?:over|more\s+than|bigger\s+than|larger\s+than|>)\s*(\d+(?:\.\d+)?)\s*(kb|mb|gb)/);
  if (over) {
    return { band: "large", min: toBytes(Number(over[1]), over[2]), max: null };
  }
  return { band: null, min: null, max: null };
}

function toBytes(amount: number, unit: string): number {
  const key = unit.toLowerCase();
  if (key === "kb") {
    return amount * 1024;
  }
  if (key === "gb") {
    return amount * GB;
  }
  return amount * MB;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
