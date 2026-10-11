import { describe, expect, it } from "vitest";
import { isIfcFile } from "@/utils/ifc";

describe("isIfcFile", () => {
  it("matches an ifc extension", () => {
    expect(isIfcFile({ name: "bridge.ifc", extension: "ifc" })).toBe(true);
    expect(isIfcFile({ name: "bridge.IFC", extension: ".IFC" })).toBe(true);
  });

  it("rejects other models", () => {
    expect(isIfcFile({ name: "model.rvt", extension: "rvt" })).toBe(false);
    expect(isIfcFile({ name: "sheet.pdf", extension: "pdf" })).toBe(false);
  });
});
