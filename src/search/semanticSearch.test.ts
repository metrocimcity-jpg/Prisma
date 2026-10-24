import { describe, expect, it } from "vitest";
import { createSampleIndex } from "@/data/sampleIndex";
import { parseSemanticIntent } from "@/search/semanticIntent";
import { intentToSearchQuery, searchSemantic, searchSemanticMany, splitSemanticAsks } from "@/search/semanticSearch";

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

  it("reads short asks like 3 newer revit models and last month pdfs", () => {
    const newer = parseSemanticIntent("3 newer revit models");
    expect(newer.limit).toBe(3);
    expect(newer.recencySort).toBe("newest");
    expect(newer.extensions).toContain("rvt");
    expect(newer.wantAll).toBe(true);

    const pdfs = parseSemanticIntent("last month pdfs");
    expect(pdfs.extensions).toContain("pdf");
    expect(pdfs.ageMode).toBe("within");
    expect(pdfs.ageDays).toBe(30);
    expect(pdfs.wantAll).toBe(true);
  });

  it("reads named dates and digit or word counts", () => {
    expect(parseSemanticIntent("pdfs today").ageMode).toBe("within");
    expect(parseSemanticIntent("pdfs today").ageDays).toBe(1);
    expect(parseSemanticIntent("revit yesterday").ageMode).toBe("around");
    expect(parseSemanticIntent("revit yesterday").ageDays).toBe(1);
    expect(parseSemanticIntent("dwg last week").ageDays).toBe(7);
    expect(parseSemanticIntent("pdf last month").ageDays).toBe(30);
    expect(parseSemanticIntent("models last year").ageDays).toBe(365);

    const thisWeek = parseSemanticIntent("pdfs this week");
    expect(thisWeek.ageMode).toBe("within");
    expect(thisWeek.ageDays).toBeGreaterThanOrEqual(1);
    expect(thisWeek.ageDays).toBeLessThanOrEqual(7);

    const thisMonth = parseSemanticIntent("rvt this month");
    expect(thisMonth.ageMode).toBe("within");
    expect(thisMonth.ageDays).toBeGreaterThanOrEqual(1);
    expect(thisMonth.ageDays).toBeLessThanOrEqual(31);

    const thisYear = parseSemanticIntent("pdf this year");
    expect(thisYear.ageMode).toBe("within");
    expect(thisYear.ageDays).toBeGreaterThanOrEqual(1);

    expect(parseSemanticIntent("last 2 weeks pdfs").ageDays).toBe(14);
    expect(parseSemanticIntent("past three months dwg").ageDays).toBe(90);
    expect(parseSemanticIntent("within ten days pdf").ageDays).toBe(10);
    expect(parseSemanticIntent("two weeks ago revit").ageMode).toBe("around");
    expect(parseSemanticIntent("two weeks ago revit").ageDays).toBe(14);
    expect(parseSemanticIntent("a month ago pdf").ageDays).toBe(30);

    const three = parseSemanticIntent("three newer revit models");
    expect(three.limit).toBe(3);
    expect(three.recencySort).toBe("newest");
    expect(parseSemanticIntent("top five pdfs").limit).toBe(5);
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

  it("returns the 3 newest revit models", () => {
    const index = createSampleIndex();
    const result = searchSemantic(index, "3 newer revit models");
    expect(result.hits).toHaveLength(3);
    expect(result.hits.every((hit) => hit.node.extension === "rvt")).toBe(true);
    const times = result.hits.map((hit) => new Date(hit.node.modifiedAt ?? 0).getTime());
    expect(times[0]).toBeGreaterThanOrEqual(times[1]);
    expect(times[1]).toBeGreaterThanOrEqual(times[2]);
  });

  it("returns pdfs from the last month", () => {
    const index = createSampleIndex();
    const result = searchSemantic(index, "last month pdfs");
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.every((hit) => hit.node.extension === "pdf")).toBe(true);
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(result.hits.every((hit) => new Date(hit.node.modifiedAt ?? 0).getTime() >= monthAgo - 12 * 60 * 60 * 1000)).toBe(true);
  });

  it("unions multi-search asks split on /", () => {
    expect(splitSemanticAsks("3 newer revit / last month pdfs / two weeks ago dwg")).toEqual([
      "3 newer revit",
      "last month pdfs",
      "two weeks ago dwg",
    ]);
    const index = createSampleIndex();
    const multi = searchSemanticMany(index, "3 newer revit / last month pdfs / two weeks ago dwg");
    const extensions = new Set(multi.hits.map((hit) => hit.node.extension));
    expect(extensions.has("rvt")).toBe(true);
    expect(extensions.has("pdf")).toBe(true);
    expect(extensions.has("dwg")).toBe(true);
    expect(multi.hits.length).toBeGreaterThan(3);
  });
});
