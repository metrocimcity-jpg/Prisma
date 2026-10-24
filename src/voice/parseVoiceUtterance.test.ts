import { describe, expect, it } from "vitest";
import { matchCell } from "@/voice/matchCell";
import { parseVoiceUtterance } from "@/voice/parseVoiceUtterance";
import { resolveFilter } from "@/voice/resolveFilter";
import type { VizNode } from "@/visualization/types";

describe("parseVoiceUtterance", () => {
  it("wakes on Prisma and sleeps on Prisma down", () => {
    expect(parseVoiceUtterance("Prisma")).toEqual([{ type: "wake" }]);
    expect(parseVoiceUtterance("Hey Prisma")).toEqual([{ type: "wake" }]);
    expect(parseVoiceUtterance("Prisma down")).toEqual([{ type: "sleep" }]);
    expect(parseVoiceUtterance("Prisma, down please")).toEqual([{ type: "sleep" }]);
  });

  it("runs a command in the same breath as the wake word", () => {
    expect(parseVoiceUtterance("Prisma back")).toEqual([{ type: "wake" }, { type: "back" }]);
    expect(parseVoiceUtterance("Prisma select floor plan")).toEqual([
      { type: "wake" },
      { type: "select", name: "floor plan" },
    ]);
  });

  it("understands select, back, reset, and filter once awake", () => {
    expect(parseVoiceUtterance("select every cell")).toEqual([{ type: "selectAll" }]);
    expect(parseVoiceUtterance("select all")).toEqual([{ type: "selectAll" }]);
    expect(parseVoiceUtterance("select reports")).toEqual([{ type: "select", name: "reports" }]);
    expect(parseVoiceUtterance("go back")).toEqual([{ type: "back" }]);
    expect(parseVoiceUtterance("reset")).toEqual([{ type: "reset" }]);
    expect(parseVoiceUtterance("reset filter")).toEqual([{ type: "filterClear" }]);
    expect(parseVoiceUtterance("clear filters")).toEqual([{ type: "filterClear" }]);
    expect(parseVoiceUtterance("filter")).toEqual([{ type: "filterPanel" }]);
    expect(parseVoiceUtterance("filter images")).toEqual([{ type: "filter", query: "images" }]);
  });

  it("accepts the way Chrome mishears Prisma and loose phrasing", () => {
    expect(parseVoiceUtterance("Prism")).toEqual([{ type: "wake" }]);
    expect(parseVoiceUtterance("prism a")).toEqual([{ type: "wake" }]);
    expect(parseVoiceUtterance("prism down")).toEqual([{ type: "sleep" }]);
    expect(parseVoiceUtterance("Prisma, go back")).toEqual([{ type: "wake" }, { type: "back" }]);
    expect(parseVoiceUtterance("back prisma")).toEqual([{ type: "wake" }, { type: "back" }]);
    expect(parseVoiceUtterance("please go back")).toEqual([{ type: "back" }]);
    expect(parseVoiceUtterance("reset the view")).toEqual([{ type: "reset" }]);
    expect(parseVoiceUtterance("select all the cells")).toEqual([{ type: "selectAll" }]);
    expect(parseVoiceUtterance("filter the pdfs")).toEqual([{ type: "filter", query: "pdfs" }]);
    expect(parseVoiceUtterance("clear the filters")).toEqual([{ type: "filterClear" }]);
  });

  it("routes natural language to Ask Prisma semantic search", () => {
    const example = "all revit models for airfield location for last month";
    expect(parseVoiceUtterance(`Prisma ${example}`)).toEqual([{ type: "wake" }, { type: "ask", text: example }]);
    expect(parseVoiceUtterance(`ask ${example}`)).toEqual([{ type: "ask", text: example }]);
    expect(parseVoiceUtterance(`find ${example}`)).toEqual([{ type: "ask", text: example }]);
    expect(parseVoiceUtterance(`show me ${example}`)).toEqual([{ type: "ask", text: example }]);
    expect(parseVoiceUtterance(example)).toEqual([{ type: "ask", text: example }]);
  });
});

describe("resolveFilter", () => {
  it("maps a category, an extension, and a name", () => {
    expect(resolveFilter("images").categories).toEqual(["Images"]);
    expect(resolveFilter("pdf").categories).toEqual(["PDF"]);
    expect(resolveFilter("pdfs").categories).toEqual(["PDF"]);
    expect(resolveFilter("rvt").extensions).toEqual(["rvt"]);
    expect(resolveFilter("floor plan").search).toBe("floor plan");
  });
});

describe("matchCell", () => {
  it("picks the closest label under the current view", () => {
    const root = cell("root", "Project", [
      cell("a", "Reports", [cell("a1", "Q1.pdf", [], "file", "file-a1")]),
      cell("b", "Archive"),
    ]);
    expect(matchCell(root, [], "reports")?.id).toBe("a");
    expect(matchCell(root, ["a"], "q1")?.sourceId).toBe("file-a1");
    expect(matchCell(root, [], "missing")).toBeNull();
  });
});

function cell(id: string, label: string, children: VizNode[] = [], nodeType: VizNode["nodeType"] = "folder", sourceId: string | null = null): VizNode {
  return {
    id,
    sourceId,
    label,
    weight: 1,
    colorKey: "",
    nodeType,
    category: null,
    extension: null,
    fileType: null,
    size: 1,
    fileCount: 1,
    children,
  };
}
