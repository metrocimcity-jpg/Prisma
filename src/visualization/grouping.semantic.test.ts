import { describe, expect, it } from "vitest";
import { createSampleIndex } from "@/data/sampleIndex";
import { searchSemantic } from "@/search/semanticSearch";
import { buildSemanticResultTree } from "@/visualization/grouping";

describe("buildSemanticResultTree", () => {
  it("lays ask hits out as adjacent root siblings", () => {
    const index = createSampleIndex();
    const result = searchSemantic(index, "all revit models for airfield location for last month");
    const hitIds = result.hits.map((hit) => hit.id);
    const tree = buildSemanticResultTree(index, hitIds, "fileSize", "", "3 Ask results");

    expect(tree.label).toBe("3 Ask results");
    expect(tree.children).toHaveLength(3);
    expect(tree.children.every((child) => child.nodeType === "file")).toBe(true);
    expect(tree.children.map((child) => child.label).sort()).toEqual([
      "Airfield-Apron.rvt",
      "Airfield-Terminal.rvt",
      "Airfield-Tower.rvt",
    ]);
    expect(tree.children.every((child) => child.children.length === 0)).toBe(true);
  });
});
