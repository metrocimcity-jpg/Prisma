import { describe, expect, it } from "vitest";
import type { IndexNode } from "@/data/types";
import { analysisBubbles, bubblesInBrush } from "@/ui/layout/analysisBubbles";

function file(partial: Partial<IndexNode> & Pick<IndexNode, "id" | "name">): IndexNode {
  return {
    parentId: null,
    path: partial.name,
    relativePath: partial.name,
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
    ...partial,
  };
}

describe("analysisBubbles", () => {
  it("uses weeks of file age, subprogram, and file size", () => {
    const now = Date.parse("2026-10-11T00:00:00Z");
    const modified = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [bubble] = analysisBubbles(
      [
        file({
          id: "a",
          name: "Harbor.rvt",
          size: 91_000_000,
          modifiedAt: modified,
          metadata: {
            "ACC-Sub Program": "Airfield Electrical & Civil",
            "ACC-Discipline": "ELE3",
          },
        }),
      ],
      now,
    );
    expect(bubble?.ageWeeks).toBeCloseTo(2, 5);
    expect(bubble?.subprogram).toBe("AE");
    expect(bubble?.size).toBe(91_000_000);
  });

  it("omits files that have no subprogram", () => {
    const bubbles = analysisBubbles([
      file({ id: "plain", name: "notes.txt" }),
      file({
        id: "tagged",
        name: "sheet.dwg",
        metadata: { "Sub Program": "Airfield Electrical & Civil", "ACC-Discipline": "ELE" },
      }),
    ]);
    expect(bubbles.map((bubble) => bubble.id)).toEqual(["tagged"]);
    expect(bubbles[0]?.subprogram).toBe("AE");
  });

  it("keeps only dots inside the brush rectangle", () => {
    const now = Date.parse("2026-10-11T00:00:00Z");
    const bubbles = analysisBubbles(
      [
        file({
          id: "inside",
          name: "a.rvt",
          modifiedAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { "ACC-Sub Program": "Airfield Electrical & Civil", "ACC-Discipline": "ELE" },
        }),
        file({
          id: "outside",
          name: "b.rvt",
          modifiedAt: new Date(now - 70 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: { "ACC-Sub Program": "PACT", "ACC-Discipline": "ARC" },
        }),
      ],
      now,
    );
    const x = (weeks: number) => weeks * 10;
    const y = (subprogram: string) => (subprogram === "AE" ? 40 : 120);
    const brushed = bubblesInBrush(bubbles, [[0, 0], [30, 80]], x, y);
    expect(brushed.map((bubble) => bubble.id)).toEqual(["inside"]);
    expect(bubblesInBrush(bubbles, null, x, y)).toEqual([]);
  });
});
