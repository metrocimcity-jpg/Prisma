import { describe, expect, it } from "vitest";
import type { IndexNode } from "@/data/types";
import type { VizNode } from "@/visualization/types";
import { accColumnsInUse, filesInScope, toScheduleRows } from "@/ui/layout/schedule";

function file(id: string, relativePath: string, metadata?: Record<string, unknown>): IndexNode {
  const name = relativePath.split("/").at(-1) ?? relativePath;
  return {
    id,
    parentId: null,
    name,
    path: relativePath,
    relativePath,
    nodeType: "file",
    extension: name.includes(".") ? name.split(".").at(-1)! : null,
    mimeType: null,
    fileType: null,
    category: null,
    subcategory: null,
    size: 10,
    createdAt: null,
    modifiedAt: null,
    accessedAt: null,
    attributes: null,
    metadata,
  };
}

function vizFile(id: string, sourceId: string): VizNode {
  return {
    id,
    sourceId,
    label: id,
    weight: 1,
    colorKey: "",
    nodeType: "file",
    category: null,
    extension: null,
    fileType: null,
    size: 10,
    fileCount: 1,
    children: [],
  };
}

describe("schedule rows", () => {
  it("lists only the files inside the open group and abbreviates ACC values", () => {
    const drawing = file("a", "BIM/Architecture/Harbor.rvt", { "ACC-Document Type": "Model - 3D", "ACC-Program": "Accelerator" });
    const other = file("b", "CAD/site.dwg");
    const group: VizNode = {
      id: "bim",
      sourceId: null,
      label: "BIM",
      weight: 1,
      colorKey: "",
      nodeType: "group",
      category: null,
      extension: null,
      fileType: null,
      size: 10,
      fileCount: 1,
      children: [vizFile("fs:a", "a")],
    };
    const byId = new Map<string, IndexNode>([
      [drawing.id, drawing],
      [other.id, other],
    ]);
    const rows = toScheduleRows(filesInScope(group, byId));
    expect(rows.map((row) => row.name)).toEqual(["Harbor.rvt"]);
    expect(rows[0]?.folder).toBe("BIM/Architecture");
    expect(rows[0]?.acc["ACC-Document Type"]).toBe("M3D");
    expect(rows[0]?.acc["ACC-Program"]).toBe("AC");
    expect(accColumnsInUse(rows).map((column) => column.label)).toEqual(["Program", "Doc Type"]);
  });
});
