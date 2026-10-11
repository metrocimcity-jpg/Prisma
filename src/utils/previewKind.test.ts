import { describe, expect, it } from "vitest";
import { previewKind } from "@/utils/previewKind";

describe("previewKind", () => {
  it("recognizes files the browser can show", () => {
    expect(previewKind({ name: "a.pdf", extension: "pdf" })).toBe("pdf");
    expect(previewKind({ name: "a.ifc", extension: "ifc" })).toBe("ifc");
    expect(previewKind({ name: "a.png", extension: "png" })).toBe("image");
    expect(previewKind({ name: "a.mp4", extension: "mp4" })).toBe("video");
    expect(previewKind({ name: "a.mp3", extension: "mp3" })).toBe("audio");
    expect(previewKind({ name: "a.txt", extension: "txt" })).toBe("text");
  });

  it("leaves Revit and CAD without a preview", () => {
    expect(previewKind({ name: "model.rvt", extension: "rvt" })).toBeNull();
    expect(previewKind({ name: "plan.dwg", extension: "dwg" })).toBeNull();
  });
});
