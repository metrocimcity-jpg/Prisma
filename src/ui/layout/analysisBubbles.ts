import type { IndexNode } from "@/data/types";
import { accMetadataRaw, accSubprogramName } from "@/metadata/accTaxonomy";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface AnalysisBubble {
  id: string;
  name: string;
  ageWeeks: number;
  ageKnown: boolean;
  subprogram: string;
  size: number;
}

/** Age is the time since the file was last modified, in weeks. */
export function ageInWeeks(modifiedAt: string | null, now: number): { weeks: number; known: boolean } {
  if (!modifiedAt) {
    return { weeks: 0, known: false };
  }
  const then = new Date(modifiedAt).getTime();
  if (Number.isNaN(then)) {
    return { weeks: 0, known: false };
  }
  return { weeks: Math.max(0, (now - then) / WEEK_MS), known: true };
}

export function analysisBubbles(files: readonly IndexNode[], now = Date.now()): AnalysisBubble[] {
  const bubbles: AnalysisBubble[] = [];
  for (const file of files) {
    const subprogram = accMetadataRaw(file.metadata, "ACC-Sub Program");
    if (!subprogram) {
      continue;
    }
    const age = ageInWeeks(file.modifiedAt, now);
    bubbles.push({
      id: file.id,
      name: file.name,
      ageWeeks: age.weeks,
      ageKnown: age.known,
      subprogram: accSubprogramName(subprogram),
      size: file.size,
    });
  }
  return bubbles;
}

/** Files whose plotted position falls inside a d3 brush selection. */
export function bubblesInBrush(
  bubbles: readonly AnalysisBubble[],
  selection: [[number, number], [number, number]] | null,
  x: (ageWeeks: number) => number,
  y: (subprogram: string) => number | undefined,
): AnalysisBubble[] {
  if (!selection) {
    return [];
  }
  const [[x0, y0], [x1, y1]] = selection;
  return bubbles.filter((bubble) => {
    const px = x(bubble.ageWeeks);
    const py = y(bubble.subprogram);
    return py !== undefined && x0 <= px && px < x1 && y0 <= py && py < y1;
  });
}
