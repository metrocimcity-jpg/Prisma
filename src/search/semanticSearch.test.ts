import { describe, expect, it } from "vitest";
import { createSampleIndex } from "@/data/sampleIndex";
import { parseSemanticIntent } from "@/search/semanticIntent";
import { intentToSearchQuery, searchSemantic } from "@/search/semanticSearch";

const EXAMPLE = "all revit models for airfield location for last month";

describe("parseSemanticIntent", () => {
  it("reads all revit models at the airfield from the last month", () => {
    const intent = parseSemanticIntent(EXAMPLE);
    expect(intent.wantAll).toBe(true);
    expect(intent.extensions).toContain("rvt");
    expect(intent.locations).toContain("airfield");
    expect(intent.ageMode).toBe("within");
    expect(intent.ageDays).toBe(30);
  });
});

describe("searchSemantic", () => {
  it("returns every airfield revit from the last month in the sample JSON", () => {
    const index = createSampleIndex();
    const result = searchSemantic(index, EXAMPLE);
    const names = result.hits.map((hit) => hit.node.name);
    expect(names).toEqual(expect.arrayContaining(["Airfield-Terminal.rvt", "Airfield-Apron.rvt", "Airfield-Tower.rvt"]));
    expect(names).not.toContain("Airfield-Cargo.rvt");
    expect(names.some((name) => name.startsWith("Harbor-"))).toBe(false);
    expect(result.favorite?.name.startsWith("Airfield-")).toBe(true);
    expect(intentToSearchQuery(result.intent)).toContain("ext:rvt");
    expect(intentToSearchQuery(result.intent)).toContain("airfield");
  });
});
