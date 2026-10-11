import { describe, expect, it } from "vitest";
import { ensureCatalog, hierarchyCatalog, hierarchyGroupBy, mergeHierarchyOrder, moveHierarchyItem } from "@/ui/layout/hierarchy";

describe("hierarchyCatalog", () => {
  it("lists built-in and ACC fields, plus JSON keys that are not ACC aliases", () => {
    const ids = hierarchyCatalog(["Zone", "discipline", "Package"]).map((field) => field.id);
    expect(ids).toContain("accDiscipline");
    expect(ids).toContain("fileType");
    expect(ids).toContain("size");
    expect(ids).toContain("meta:Zone");
    expect(ids).toContain("meta:Package");
    expect(ids).not.toContain("meta:discipline");
  });
});

describe("moveHierarchyItem", () => {
  const order = ["folder", "fileType", "size", "accDiscipline"];

  it("moves an item before the row under the pointer", () => {
    expect(moveHierarchyItem(order, "accDiscipline", "fileType", true)).toEqual(["folder", "accDiscipline", "fileType", "size"]);
  });

  it("moves an item after the row when the pointer is in the lower half", () => {
    expect(moveHierarchyItem(order, "folder", "size", false)).toEqual(["fileType", "size", "folder", "accDiscipline"]);
  });

  it("leaves the list alone when the drop does not change order", () => {
    const same = moveHierarchyItem(order, "fileType", "folder", false);
    expect(same).toBe(order);
  });
});

describe("hierarchyGroupBy", () => {
  it("keeps checked fields in list order", () => {
    expect(hierarchyGroupBy(["accDiscipline", "folder", "fileType", "size"], ["fileType", "accDiscipline", "size"])).toEqual([
      "accDiscipline",
      "fileType",
      "size",
    ]);
  });

  it("falls back to the folder tree when nothing is checked", () => {
    expect(hierarchyGroupBy(["fileType", "size"], [])).toEqual(["folder"]);
  });
});

describe("mergeHierarchyOrder", () => {
  it("puts the active hierarchy first and keeps new metadata keys", () => {
    expect(mergeHierarchyOrder(["size", "folder"], ["folder", "fileType", "meta:Zone"], ["fileType"])).toEqual([
      "fileType",
      "folder",
      "meta:Zone",
    ]);
  });

  it("appends catalog keys that are missing from a custom order", () => {
    expect(ensureCatalog(["size", "folder"], ["folder", "size", "meta:Zone"])).toEqual(["size", "folder", "meta:Zone"]);
  });
});
