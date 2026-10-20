import { describe, expect, it } from "vitest";
import { categoryGroupActive, toggleCategoryGroup } from "@/filtering/categoryGroups";

describe("category groups", () => {
  it("treats CAD as part of BIM", () => {
    const next = toggleCategoryGroup([], ["BIM", "CAD"]);
    expect(next).toEqual(["BIM", "CAD"]);
    expect(categoryGroupActive(next, ["BIM", "CAD"])).toBe(true);
    expect(toggleCategoryGroup(["BIM"], ["BIM", "CAD"])).toEqual([]);
  });
});
