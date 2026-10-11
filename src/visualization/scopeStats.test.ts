import { describe, expect, it } from "vitest";
import { buildFileIndex } from "@/data/aggregate";
import { buildGroupedTree } from "@/visualization/grouping";
import { scopeStats } from "@/visualization/scopeStats";
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

describe("scopeStats", () => {
  it("counts only the files inside the open group", () => {
    const index = buildFileIndex({
      rootName: "p",
      rootPath: "p",
      entries: [file("a.rvt", 10), file("b.dwg", 20), file("c.dwg", 5)],
    });
    const visible = new Set(index.items.filter((item) => item.nodeType === "file").map((item) => item.id));
    const tree = buildGroupedTree(index, visible, ["category"], "fileSize", "");
    const bim = tree.children.find((child) => child.label === "BIM");
    const cad = tree.children.find((child) => child.label === "CAD");
    expect(bim).toBeTruthy();
    expect(cad).toBeTruthy();
    expect(scopeStats(bim!).fileCount).toBe(1);
    expect(scopeStats(bim!).totalSize).toBe(10);
    expect(scopeStats(bim!).types.map((entry) => entry.ext)).toEqual(["rvt"]);
    expect(scopeStats(cad!).fileCount).toBe(2);
    expect(scopeStats(cad!).totalSize).toBe(25);
    expect(scopeStats(tree).fileCount).toBe(3);
    expect(scopeStats(tree).totalSize).toBe(35);
  });
});
