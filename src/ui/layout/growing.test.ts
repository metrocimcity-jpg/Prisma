import { describe, expect, it } from "vitest";
import type { IndexNode } from "@/data/types";
import { disciplineLegendLabel, growingFileModel, growingModel, growingSnapshot, growingTrail } from "@/ui/layout/growing";

function file(name: string, history: Array<[number, number, string]>, relativePath = name): IndexNode {
  return {
    id: name,
    parentId: null,
    name,
    path: name,
    relativePath,
    nodeType: "file",
    extension: null,
    mimeType: null,
    fileType: null,
    category: null,
    subcategory: null,
    size: 0,
    createdAt: null,
    modifiedAt: null,
    accessedAt: null,
    attributes: null,
    metadata: {
      versionHistory: history.map(([version, sizeMb, modifiedAt]) => ({ version, sizeMb, modifiedAt })),
    },
  };
}

describe("disciplineLegendLabel", () => {
  it("drops the trailing subdiscipline digit from a code", () => {
    expect(disciplineLegendLabel("AES0")).toBe("AES");
    expect(disciplineLegendLabel("ARC0")).toBe("ARC");
    expect(disciplineLegendLabel("Airfield Ground Lighting")).toBe("Airfield Ground Lighting");
  });
});

describe("growingModel", () => {
  it("keeps one circle track per discipline and sums file size", () => {
    const model = growingModel([
      file("L-AC-AE-PD-F0326-ARC0-DRG-1.pdf", [
        [1, 40, "2025-09-02 09:00"],
        [2, 55, "2025-10-02 09:00"],
      ]),
      file("L-AC-AE-PD-F0326-ARC0-DRG-2.pdf", [[1, 20, "2025-09-02 11:00"]]),
      file("L-AC-AE-PD-F0326-ELE0-DRG-1.dwg", [[1, 18, "2025-09-03 10:00"]]),
    ]);
    expect(model.series.map((series) => series.discipline)).toEqual(["ARC0", "ELE0"]);
    const architecture = model.series[0]?.points[0];
    expect(architecture?.version).toBe(1);
    expect(architecture?.sizeMb).toBe(60);
    const later = model.series[0]?.points.at(-1);
    expect(later?.version).toBe(2);
    expect(later?.sizeMb).toBe(75);
  });

  it("moves a discipline along date and version as the playhead advances", () => {
    const model = growingModel([
      file("L-AC-AE-PD-F0326-ARC0-DRG-1.pdf", [
        [1, 40, "2025-09-01 09:00"],
        [3, 80, "2025-09-11 09:00"],
      ]),
    ]);
    const start = Date.parse("2025-09-01T09:00");
    const mid = Date.parse("2025-09-06T09:00");
    const end = Date.parse("2025-09-11T09:00");
    expect(growingSnapshot(model, start)[0]).toMatchObject({ discipline: "ARC0", version: 1, sizeMb: 40 });
    const middle = growingSnapshot(model, mid)[0];
    expect(middle?.date).toBe(mid);
    expect(middle?.version).toBeGreaterThan(1);
    expect(middle?.version).toBeLessThan(3);
    expect(middle?.sizeMb).toBeGreaterThan(40);
    expect(middle?.sizeMb).toBeLessThan(80);
    expect(growingSnapshot(model, end)[0]).toMatchObject({ version: 3, sizeMb: 80 });
  });

  it("grows a trail only as far as the circle has moved", () => {
    const model = growingModel([
      file("L-AC-AE-PD-F0326-ARC0-DRG-1.pdf", [
        [1, 40, "2025-09-01 09:00"],
        [3, 80, "2025-09-11 09:00"],
      ]),
    ]);
    const track = model.series[0];
    expect(track).toBeDefined();
    const before = Date.parse("2025-08-01T09:00");
    const mid = Date.parse("2025-09-06T09:00");
    const after = Date.parse("2026-01-01T09:00");
    expect(growingTrail(track!, before)).toBeNull();
    const trail = growingTrail(track!, mid);
    expect(trail?.points).toHaveLength(1);
    expect(trail?.points[0]).toMatchObject({ version: 1, sizeMb: 40 });
    const finished = growingTrail(track!, after);
    expect(finished?.points).toHaveLength(1);
    expect(finished?.points[0]).toMatchObject({ version: 1, sizeMb: 40 });
  });

  it("keeps one circle per file and the discipline color key", () => {
    const model = growingFileModel([
      file("L-AC-AE-PD-F0326-ARC0-DRG-2.pdf", [[1, 20, "2025-09-02 11:00"]]),
      file("L-AC-AE-PD-F0326-ARC0-DRG-1.pdf", [
        [1, 40, "2025-09-02 09:00"],
        [2, 55, "2025-10-02 09:00"],
      ]),
      file("L-AC-AE-PD-F0326-ELE0-DRG-1.dwg", [[1, 18, "2025-09-03 10:00"]]),
    ]);
    expect(model.series.map((series) => series.label)).toEqual([
      "L-AC-AE-PD-F0326-ARC0-DRG-1.pdf",
      "L-AC-AE-PD-F0326-ARC0-DRG-2.pdf",
      "L-AC-AE-PD-F0326-ELE0-DRG-1.dwg",
    ]);
    expect(model.series.map((series) => series.discipline)).toEqual(["ARC0", "ARC0", "ELE0"]);
    expect(model.series[0]?.points[0]?.sizeMb).toBe(40);
    expect(model.series[1]?.points[0]?.sizeMb).toBe(20);
    const later = growingSnapshot(model, Date.parse("2025-10-02T09:00"))[0];
    expect(later).toMatchObject({ label: "L-AC-AE-PD-F0326-ARC0-DRG-1.pdf", discipline: "ARC0", version: 2, sizeMb: 55 });
  });
});
