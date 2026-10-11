import type { IndexNode } from "@/data/types";
import { accMetadataRaw, accSubprogramName } from "@/metadata/accTaxonomy";

export interface AnalysisLinePoint {
  id: string;
  name: string;
  modifiedAt: number;
  subprogram: string;
  /** Running count of files in this subprogram, in modified-date order. */
  fileCount: number;
}

/** One point per file that has a subprogram and a modified time. */
export function analysisLines(files: readonly IndexNode[]): AnalysisLinePoint[] {
  const points: AnalysisLinePoint[] = [];
  for (const file of files) {
    const subprogram = accMetadataRaw(file.metadata, "ACC-Sub Program");
    if (!subprogram || !file.modifiedAt) {
      continue;
    }
    const modifiedAt = new Date(file.modifiedAt).getTime();
    if (Number.isNaN(modifiedAt)) {
      continue;
    }
    points.push({
      id: file.id,
      name: file.name,
      modifiedAt,
      subprogram: accSubprogramName(subprogram),
      fileCount: 0,
    });
  }
  const counts = new Map<string, number>();
  return [...points].sort((a, b) => a.modifiedAt - b.modifiedAt || a.name.localeCompare(b.name)).map((point) => {
    const fileCount = (counts.get(point.subprogram) ?? 0) + 1;
    counts.set(point.subprogram, fileCount);
    return { ...point, fileCount };
  });
}
