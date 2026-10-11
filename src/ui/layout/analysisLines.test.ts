import { describe, expect, it } from "vitest";
import type { IndexNode } from "@/data/types";
import { analysisLines } from "@/ui/layout/analysisLines";

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

describe("analysisLines", () => {
  it("keeps files that have a subprogram and a modified date", () => {
    const modified = "2026-09-01T00:00:00.000Z";
    const points = analysisLines([
      file({ id: "plain", name: "a.txt", modifiedAt: modified }),
      file({ id: "nodate", name: "b.rvt", metadata: { "ACC-Sub Program": "Airfield Electrical & Civil" } }),
      file({
        id: "ok",
        name: "c.rvt",
        modifiedAt: modified,
        metadata: { "ACC-Sub Program": "Airfield Electrical & Civil" },
      }),
    ]);
    expect(points.map((point) => point.id)).toEqual(["ok"]);
    expect(points[0]?.subprogram).toBe("Airfield Electrical & Civil");
    expect(points[0]?.modifiedAt).toBe(Date.parse(modified));
    expect(points[0]?.fileCount).toBe(1);
  });

  it("counts files in each subprogram by modified date", () => {
    const points = analysisLines([
      file({
        id: "late",
        name: "b.rvt",
        modifiedAt: "2026-09-03T00:00:00.000Z",
        metadata: { "ACC-Sub Program": "Airfield Electrical & Civil" },
      }),
      file({
        id: "early",
        name: "a.rvt",
        modifiedAt: "2026-09-01T00:00:00.000Z",
        metadata: { "ACC-Sub Program": "Airfield Electrical & Civil" },
      }),
      file({
        id: "other",
        name: "c.dwg",
        modifiedAt: "2026-09-02T00:00:00.000Z",
        metadata: { "ACC-Sub Program": "Passenger Processing" },
      }),
    ]);
    expect(points.map((point) => [point.id, point.subprogram, point.fileCount])).toEqual([
      ["early", "Airfield Electrical & Civil", 1],
      ["other", "Passenger Processing", 1],
      ["late", "Airfield Electrical & Civil", 2],
    ]);
  });
});
