import type { FileIndex, IndexNode } from "@/data/types";
import { parseSemanticIntent, type SemanticIntent } from "@/search/semanticIntent";

export interface SemanticHit {
  id: string;
  score: number;
  reasons: string[];
  node: IndexNode;
}

export interface SemanticSearchResult {
  intent: SemanticIntent;
  hits: SemanticHit[];
  favorite: IndexNode | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rank files in a loaded JSON index for a natural-language ask. */
export function searchSemantic(index: FileIndex | null | undefined, ask: string): SemanticSearchResult {
  const intent = parseSemanticIntent(ask);
  if (!index) {
    return { intent, hits: [], favorite: null };
  }
  const files = index.items.filter((item) => item.nodeType === "file");
  if (files.length === 0 || !intent.raw.trim()) {
    return { intent, hits: [], favorite: null };
  }

  const hits: SemanticHit[] = [];
  for (const node of files) {
    const scored = scoreNode(node, intent);
    if (scored.score <= 0) {
      continue;
    }
    hits.push({ id: node.id, score: scored.score, reasons: scored.reasons, node });
  }
  hits.sort((left, right) => right.score - left.score || left.node.name.localeCompare(right.node.name));
  return {
    intent,
    hits,
    favorite: hits[0]?.node ?? null,
  };
}

function scoreNode(node: IndexNode, intent: SemanticIntent): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const haystack = textHaystack(node);
  const meta = flattenMetadata(node);

  if (intent.extensions.length > 0) {
    const ext = (node.extension ?? "").toLowerCase();
    if (intent.extensions.includes(ext)) {
      score += 40;
      reasons.push(`.${ext}`);
    } else {
      return { score: 0, reasons: [] };
    }
  }

  if (intent.categories.length > 0) {
    const category = (node.category ?? "").toLowerCase();
    if (intent.categories.some((item) => item.toLowerCase() === category)) {
      score += 18;
      reasons.push(node.category ?? "category");
    } else if (!intent.pathHints.some((hint) => haystack.includes(hint.toLowerCase()))) {
      score -= 12;
    }
  }

  for (const hint of intent.pathHints) {
    if (haystack.includes(hint.toLowerCase())) {
      score += 24;
      reasons.push(hint);
    }
  }

  if (intent.locations.length > 0) {
    const matchedLocation = intent.locations.find((location) => haystack.includes(location) || meta.includes(location));
    if (!matchedLocation) {
      return { score: 0, reasons: [] };
    }
    score += 30;
    reasons.push(matchedLocation);
  }

  for (const discipline of intent.disciplines) {
    if (meta.includes(discipline.toLowerCase()) || haystack.includes(discipline.toLowerCase())) {
      score += 10;
      reasons.push(discipline);
    }
  }

  for (const documentType of intent.documentTypes) {
    if (meta.includes(documentType.toLowerCase())) {
      score += 8;
      reasons.push(documentType);
    }
  }

  for (const keyword of intent.keywords) {
    if (haystack.includes(keyword) || meta.includes(keyword)) {
      score += 6;
      reasons.push(keyword);
    }
  }

  if (intent.sizeMaxBytes !== null || intent.sizeMinBytes !== null || intent.sizeBand) {
    const sizeScore = scoreSize(node.size, intent);
    if (sizeScore <= 0 && intent.sizeBand) {
      return { score: 0, reasons: [] };
    }
    score += sizeScore;
    if (sizeScore > 0 && intent.sizeBand) {
      reasons.push(`${intent.sizeBand} file`);
    }
  }

  if (intent.ageDays !== null && intent.ageMode) {
    const ageScore = scoreAge(node.modifiedAt, intent.ageMode, intent.ageDays, intent.ageToleranceDays);
    if (ageScore <= 0) {
      return { score: 0, reasons: [] };
    }
    score += ageScore;
    reasons.push(intent.ageMode === "within" ? `last ${intent.ageDays} days` : `${intent.ageDays} days ago`);
  }

  // Prefer real project files over tiny stubs when nothing else distinguishes them.
  if (node.size > 1024) {
    score += 1;
  }

  return { score, reasons: unique(reasons) };
}

function scoreSize(size: number, intent: SemanticIntent): number {
  if (intent.sizeMaxBytes !== null && size > intent.sizeMaxBytes) {
    return intent.sizeBand ? 0 : -8;
  }
  if (intent.sizeMinBytes !== null && size < intent.sizeMinBytes) {
    return intent.sizeBand ? 0 : -8;
  }
  if (!intent.sizeBand) {
    return 0;
  }
  switch (intent.sizeBand) {
    case "tiny":
      return size <= 2 * 1024 ** 2 ? 22 : 0;
    case "small":
      if (size <= 10 * 1024 ** 2) {
        return 26;
      }
      if (size <= 50 * 1024 ** 2) {
        return 18;
      }
      return 0;
    case "medium":
      return size >= 20 * 1024 ** 2 && size <= 200 * 1024 ** 2 ? 16 : 0;
    case "large":
      return size >= 100 * 1024 ** 2 ? 16 : 0;
    case "huge":
      return size >= 500 * 1024 ** 2 ? 18 : 0;
    default:
      return 0;
  }
}

function scoreAge(
  modifiedAt: string | null,
  mode: "around" | "within",
  targetDays: number,
  tolerance: number,
): number {
  if (!modifiedAt) {
    return 0;
  }
  const time = new Date(modifiedAt).getTime();
  if (!Number.isFinite(time)) {
    return 0;
  }
  const ageDays = Math.max(0, (Date.now() - time) / DAY_MS);
  if (mode === "within") {
    if (ageDays > targetDays + 0.5) {
      return 0;
    }
    // Prefer newer files slightly when asking for everything in a window.
    return Math.round(20 + 10 * (1 - ageDays / Math.max(targetDays, 1)));
  }
  const distance = Math.abs(ageDays - targetDays);
  if (distance > tolerance) {
    return 0;
  }
  return Math.round(28 * (1 - distance / Math.max(tolerance, 1)));
}

function textHaystack(node: IndexNode): string {
  return [node.name, node.relativePath, node.path, node.extension ?? "", node.fileType ?? "", node.category ?? "", node.subcategory ?? ""]
    .join(" ")
    .toLowerCase();
}

function flattenMetadata(node: IndexNode): string {
  if (!node.metadata) {
    return "";
  }
  return Object.values(node.metadata)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value))
    .join(" ")
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/** Build a classic Prisma search string from intent so the map can filter. */
export function intentToSearchQuery(intent: SemanticIntent): string {
  const parts: string[] = [];
  for (const ext of intent.extensions) {
    parts.push(`ext:${ext}`);
  }
  // Prefer path folder hints over broad category so Architecture + rvt stays tight.
  if (intent.pathHints.length > 0) {
    for (const hint of intent.pathHints) {
      parts.push(hint);
    }
  } else {
    for (const category of intent.categories) {
      parts.push(`category:${category}`);
    }
  }
  for (const location of intent.locations) {
    parts.push(location.includes(" ") ? `"${location}"` : location);
  }
  if (intent.sizeMaxBytes !== null) {
    const mb = intent.sizeMaxBytes / (1024 ** 2);
    parts.push(mb >= 1 ? `size:<${Math.round(mb)}MB` : `size:<${Math.round(intent.sizeMaxBytes)}`);
  } else if (intent.sizeMinBytes !== null) {
    const mb = intent.sizeMinBytes / (1024 ** 2);
    parts.push(mb >= 1 ? `size:>${Math.round(mb)}MB` : `size:>${Math.round(intent.sizeMinBytes)}`);
  }
  return parts.join(" ");
}
