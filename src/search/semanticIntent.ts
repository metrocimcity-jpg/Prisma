/**
 * Turns a human sentence into structured intent for ranking files from a JSON index.
 * Examples: "all revit models for airfield location for last month",
 * "3 newer revit models", "last month pdfs"
 */

export type SizeBand = "tiny" | "small" | "medium" | "large" | "huge";
/** `around` = about N days ago. `within` = modified in the last N days. */
export type AgeMode = "around" | "within";
/** Prefer ranking by modified date after filters match. */
export type RecencySort = "newest" | "oldest";

export interface SemanticIntent {
  raw: string;
  /** Prefer every matching file, not a single favorite. */
  wantAll: boolean;
  /** Cap how many hits to keep (e.g. "3 newer revit models"). */
  limit: number | null;
  /** Sort matches by file age when the ask says newer / oldest / latest. */
  recencySort: RecencySort | null;
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
  "newer",
  "newest",
  "latest",
  "recent",
  "recently",
  "older",
  "oldest",
  "top",
  "first",
  "only",
  "most",
  "today",
  "yesterday",
  "tomorrow",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
  "hundred",
  "previous",
  "during",
  "within",
  "since",
]);

/** Spoken or written counts used in limits and date windows. */
const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

const NUMBER_TOKEN = String.raw`(?:\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)`;
const TIME_UNIT = String.raw`(days?|weeks?|months?|years?)`;

const EXTENSION_ALIASES: Array<{ match: RegExp; ext: string }> = [
  { match: /\brevit\b|\.rvt\b|\brvt\b/, ext: "rvt" },
  { match: /\bautodesk\s+family\b|\.rfa\b|\brfa\b/, ext: "rfa" },
  { match: /\btemplate\b.*\brevit\b|\.rte\b|\brte\b/, ext: "rte" },
  { match: /\bifc\b|\.ifc\b/, ext: "ifc" },
  { match: /\bnavisworks\b|\.nwd\b|\bnwd\b/, ext: "nwd" },
  { match: /\.nwc\b|\bnwc\b/, ext: "nwc" },
  { match: /\bautocad\b|\bdwgs?\b|\.dwg\b/, ext: "dwg" },
  { match: /\bdxf\b|\.dxf\b/, ext: "dxf" },
  { match: /\bpdfs?\b|\.pdf\b/, ext: "pdf" },
  { match: /\bexcel\b|\bxlsx\b|\.xlsx\b/, ext: "xlsx" },
  { match: /\bword\b|\bdocx\b|\.docx\b/, ext: "docx" },
  { match: /\bpngs?\b|\.png\b/, ext: "png" },
  { match: /\bjpgs?\b|\bjpegs?\b|\.jpe?g\b/, ext: "jpg" },
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
  { match: /\bpdfs?\b|\breports?\b/, category: "PDF" },
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
  const limit = parseLimit(text);
  const recencySort = parseRecencySort(text);
  const pluralAsk = /\b(?:pdfs|models|files|documents|drawings|images|dwgs|rvts)\b/.test(text);

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
    "pdfs",
    "dwgs",
    "rvts",
  ]);

  const keywords = text
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP.has(token) && !/^\d+(\.\d+)?$/.test(token))
    .filter((token) => !covered.has(token.replace(/^\./, "")));

  return {
    raw,
    wantAll: /\b(?:all|every|each)\b/.test(text) || pluralAsk || (limit !== null && limit > 1),
    limit,
    recencySort,
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

function parseLimit(text: string): number | null {
  const patterns = [
    new RegExp(String.raw`\b(?:top|first|only)\s+(${NUMBER_TOKEN})\b`),
    new RegExp(String.raw`\b(${NUMBER_TOKEN})\s+(?:newer|newest|latest|recent|older|oldest)\b`),
    new RegExp(
      String.raw`\b(${NUMBER_TOKEN})\s+(?:revit|autocad|pdf|pdfs|dwg|dwgs|rvt|models?|files?|documents?|drawings?|images?)\b`,
    ),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const value = parseCountToken(match[1]);
    if (value !== null && value > 0 && value <= 200) {
      return value;
    }
  }
  return null;
}

function parseRecencySort(text: string): RecencySort | null {
  if (/\b(?:older|oldest|earliest)\b/.test(text)) {
    return "oldest";
  }
  if (/\b(?:newer|newest|latest|most\s+recent|recent(?:ly)?)\b/.test(text)) {
    return "newest";
  }
  return null;
}

function parseAgeDays(text: string): { mode: AgeMode | null; days: number | null; tolerance: number } {
  if (/\btoday\b|\bjust\s+now\b|\bright\s+now\b/.test(text)) {
    return { mode: "within", days: 1, tolerance: 0 };
  }
  if (/\bday\s+before\s+yesterday\b/.test(text)) {
    return { mode: "around", days: 2, tolerance: 1 };
  }
  if (/\byesterday\b/.test(text)) {
    return { mode: "around", days: 1, tolerance: 1 };
  }

  // Calendar windows: this week / this month / this year (so far).
  if (/\bthis\s+week\b/.test(text)) {
    return { mode: "within", days: daysSinceStartOfWeek(), tolerance: 0 };
  }
  if (/\bthis\s+month\b/.test(text)) {
    return { mode: "within", days: daysSinceStartOfMonth(), tolerance: 0 };
  }
  if (/\bthis\s+year\b/.test(text)) {
    return { mode: "within", days: daysSinceStartOfYear(), tolerance: 0 };
  }

  // Named last/past/previous periods.
  if (/\b(?:last|past|previous)\s+week\b|\bin\s+the\s+last\s+week\b/.test(text)) {
    return { mode: "within", days: 7, tolerance: 0 };
  }
  if (/\b(?:last|past|previous)\s+month\b|\bin\s+the\s+last\s+month\b/.test(text)) {
    return { mode: "within", days: 30, tolerance: 0 };
  }
  if (/\b(?:last|past|previous)\s+year\b|\bin\s+the\s+last\s+year\b/.test(text)) {
    return { mode: "within", days: 365, tolerance: 0 };
  }
  if (/\b(?:last|past|previous)\s+day\b|\blast\s+night\b/.test(text)) {
    return { mode: "within", days: 1, tolerance: 0 };
  }

  // "last 2 weeks", "past three months", "in the last 10 days", "within two weeks"
  const within = text.match(
    new RegExp(String.raw`(?:(?:in|within|during)\s+(?:the\s+)?)?(?:last|past|previous)\s+(${NUMBER_TOKEN})\s+${TIME_UNIT}`),
  );
  if (within) {
    const amount = parseCountToken(within[1]);
    if (amount !== null) {
      return { mode: "within", days: unitToDays(amount, within[2]), tolerance: 0 };
    }
  }
  const withinAlt = text.match(new RegExp(String.raw`\b(?:within|in)\s+(?:the\s+)?(?:last\s+)?(${NUMBER_TOKEN})\s+${TIME_UNIT}`));
  if (withinAlt) {
    const amount = parseCountToken(withinAlt[1]);
    if (amount !== null) {
      return { mode: "within", days: unitToDays(amount, withinAlt[2]), tolerance: 0 };
    }
  }

  // "2 days ago", "three weeks ago", "a month ago"
  const ago = text.match(new RegExp(String.raw`\b(${NUMBER_TOKEN})\s+${TIME_UNIT}\s+ago\b`));
  if (ago) {
    const amount = parseCountToken(ago[1]);
    if (amount !== null) {
      const days = unitToDays(amount, ago[2]);
      return { mode: "around", days, tolerance: Math.max(2, Math.round(days * 0.35)) };
    }
  }

  return { mode: null, days: null, tolerance: 7 };
}

function parseCountToken(token: string): number | null {
  const cleaned = token.trim().toLowerCase();
  if (/^\d{1,3}$/.test(cleaned)) {
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
  }
  return NUMBER_WORDS[cleaned] ?? null;
}

function unitToDays(amount: number, unit: string): number {
  if (unit.startsWith("week")) {
    return amount * 7;
  }
  if (unit.startsWith("month")) {
    return amount * 30;
  }
  if (unit.startsWith("year")) {
    return amount * 365;
  }
  return amount;
}

function daysSinceStartOfWeek(): number {
  const now = new Date();
  const day = now.getDay(); // 0 Sunday … 6 Saturday
  const mondayBased = day === 0 ? 6 : day - 1;
  return Math.max(1, mondayBased + 1);
}

function daysSinceStartOfMonth(): number {
  return Math.max(1, new Date().getDate());
}

function daysSinceStartOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
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
