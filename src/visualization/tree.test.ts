import { describe, expect, it } from "vitest";
import { buildFileIndex } from "@/data/aggregate";
import type { RawScanEntry } from "@/data/types";
import { buildGroupedTree } from "@/visualization/grouping";
import { vizPathById, vizPathBySourceId } from "@/visualization/tree";

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

describe("viz path", () => {
  it("follows each group level down to the selected file", () => {
    const index = buildFileIndex({
      rootName: "Airport",
      rootPath: "Airport",
      entries: [file("models/L-AC-AE-PD.rvt", 200 * 1024 * 1024), file("drawings/site.dwg", 20 * 1024)],
    });
    const visible = new Set(index.items.filter((item) => item.nodeType === "file").map((item) => item.id));
    const tree = buildGroupedTree(index, visible, ["category", "fileType", "size"], "fileSize", "");
    const model = index.items.find((item) => item.name === "L-AC-AE-PD.rvt");
    const path = vizPathBySourceId(tree, model?.id ?? "");
    expect(path.map((node) => node.label)).toEqual(["BIM", "Revit Model", "100 MB +", "L-AC-AE-PD.rvt"]);
    const sizeGroup = path[2];
    expect(vizPathById(tree, sizeGroup?.id ?? "").map((node) => node.label)).toEqual([
      "BIM",
      "Revit Model",
      "100 MB +",
    ]);
  });
});
