import { describe, expect, it } from "vitest";
import { buildFileIndex } from "@/data/aggregate";
import { buildGroupedTree } from "@/visualization/grouping";
import { squarify } from "@/visualization/layout/squarify";
import type { RawScanEntry } from "@/data/types";

function file(relativePath: string, size: number): RawScanEntry {
  return {
    relativePath,
    name: relativePath.split("/").at(-1) ?? relativePath,
    nodeType: "file",
    size,
    createdAt: null,
    modifiedAt: null,
    accessedAt: null,
    attributes: null,
    mimeHint: null,
  };
}

describe("grouping", () => {
  it("groups files by category then extension", () => {
    const index = buildFileIndex({
      rootName: "p",
      rootPath: "p",
      entries: [file("a.rvt", 10), file("b.dwg", 20), file("c.dwg", 5)],
    });
    const visible = new Set(index.items.filter((item) => item.nodeType === "file").map((item) => item.id));
    const tree = buildGroupedTree(index, visible, ["category", "extension"], "fileSize", "");
    const categories = tree.children.map((child) => child.label).sort();
    expect(categories).toEqual(["BIM", "CAD"]);
  });

  it("groups ACC categories by the full parameter name", () => {
    const index = buildFileIndex({
      rootName: "p",
      rootPath: "p",
      entries: [file("L-AC-AE-GT-F0326-ACS0-DRG-1.rvt", 10)],
    });
    const visible = new Set(index.items.filter((item) => item.nodeType === "file").map((item) => item.id));
    const tree = buildGroupedTree(index, visible, ["accSubProgram"], "fileSize", "");
    expect(tree.children.map((child) => child.label)).toEqual(["Airfield Electrical & Civil"]);
  });
});

describe("squarify", () => {
  it("fills the target rectangle", () => {
    const laid = squarify(
      [
        { item: "a", weight: 6 },
        { item: "b", weight: 6 },
        { item: "c", weight: 4 },
      ],
      { x: 0, y: 0, w: 100, h: 100 },
    );
    const area = laid.reduce((sum, cell) => sum + cell.rect.w * cell.rect.h, 0);
    expect(area).toBeCloseTo(10000, 0);
    expect(laid).toHaveLength(3);
  });
});
