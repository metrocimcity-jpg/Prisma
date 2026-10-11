import { describe, expect, it } from "vitest";
import { isPdfFile } from "@/utils/pdf";

describe("isPdfFile", () => {
  it("matches a pdf extension", () => {
    expect(isPdfFile({ name: "sheet.pdf", extension: "pdf", mimeType: "application/pdf" })).toBe(true);
  });

  it("matches a dotted extension or filename", () => {
    expect(isPdfFile({ name: "sheet.PDF", extension: ".PDF", mimeType: null })).toBe(true);
    expect(isPdfFile({ name: "notes.Pdf", extension: null, mimeType: null })).toBe(true);
  });

  it("rejects other drawings", () => {
    expect(isPdfFile({ name: "model.rvt", extension: "rvt", mimeType: null })).toBe(false);
    expect(isPdfFile({ name: "plan.dwg", extension: "dwg", mimeType: "image/vnd.dwg" })).toBe(false);
  });
});
