/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { createPrismaApi } from "@/api/prismaApi";
import { actions } from "@/state/store";

describe("prisma API", () => {
  beforeEach(() => {
    actions.loadSample();
  });

  it("loads sample JSON and finds the airfield revit", () => {
    const api = createPrismaApi();
    expect(api.getIndex()?.root.name).toBe("Harbor-Bridge");
    expect(api.findFile("Airfield-Terminal.rvt")?.extension).toBe("rvt");
  });

  it("filters by category and extension", () => {
    const api = createPrismaApi();
    api.filterCategory("images");
    expect(api.getState().filters.categories).toEqual(["Images"]);
    api.filterExtension("rvt");
    expect(api.getState().filters.extensions).toEqual(["rvt"]);
    api.clearFilters();
    expect(api.getState().filters.extensions).toEqual([]);
  });

  it("selects and opens a named cell", () => {
    const api = createPrismaApi();
    const clicked = api.click("BIM");
    expect(clicked.ok).toBe(true);
    if (clicked.ok) {
      expect(clicked.label).toBe("BIM");
    }
    const opened = api.doubleClick("Airfield-Terminal.rvt");
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.kind).toBe("file");
      expect(api.getSelected()?.name).toBe("Airfield-Terminal.rvt");
    }
  });

  it("asks for all airfield revit models from the last month", () => {
    const api = createPrismaApi();
    const result = api.ask("all revit models for airfield location for last month");
    expect(result.hits.length).toBeGreaterThanOrEqual(3);
    expect(result.hits.every((hit) => hit.node.name.startsWith("Airfield-") && hit.node.extension === "rvt")).toBe(true);
    expect(result.hits.some((hit) => hit.node.name === "Airfield-Cargo.rvt")).toBe(false);
    expect(api.getSelected()?.name.startsWith("Airfield-")).toBe(true);
    const state = api.getState();
    expect(state.semanticHitIds).toHaveLength(result.hits.length);
    expect(state.vizTree?.children.map((child) => child.label).sort()).toEqual(
      result.hits.map((hit) => hit.node.name).sort(),
    );
    expect(state.vizTree?.children.every((child) => child.nodeType === "file")).toBe(true);
  });
});

