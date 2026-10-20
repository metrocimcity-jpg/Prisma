import { describe, expect, it } from "vitest";
import { DefaultFileClassifier } from "@/metadata/FileClassifier";

const classifier = new DefaultFileClassifier();

describe("DefaultFileClassifier", () => {
  it("classifies Revit and CAD extensions", () => {
    expect(classifier.classify({ name: "model.rvt", nodeType: "file" })).toMatchObject({
      extension: "rvt",
      category: "BIM",
      fileType: "Revit Model",
    });
    expect(classifier.classify({ name: "plan.dwg", nodeType: "file" })).toMatchObject({
      extension: "dwg",
      category: "CAD",
    });
    expect(classifier.classify({ name: "site.ifc", nodeType: "file" }).category).toBe("BIM");
    expect(classifier.classify({ name: "cloud.las", nodeType: "file" }).category).toBe("GIS");
    expect(classifier.classify({ name: "graph.dyn", nodeType: "file" })).toMatchObject({
      category: "Programming",
      fileType: "Dynamo Graph",
    });
  });

  it("does not invent a type for unknown extensions", () => {
    const result = classifier.classify({ name: "notes.xyz", nodeType: "file" });
    expect(result.extension).toBe("xyz");
    expect(result.fileType).toBeNull();
    expect(result.category).toBe("Other");
  });

  it("classifies folders without extensions", () => {
    expect(classifier.classify({ name: "BIM", nodeType: "folder" })).toMatchObject({
      extension: null,
      fileType: "Folder",
      category: null,
    });
  });
});
