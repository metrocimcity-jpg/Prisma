import { describe, expect, it } from "vitest";
import { formatAccLabel, inferAccTaxonomy, isAccAcceleratorNamed, mergeAccTaxonomyMetadata } from "@/metadata/accTaxonomy";

describe("formatAccLabel", () => {
  it("uses the full parameter name and drops the code", () => {
    expect(formatAccLabel("FEC A (Reserved)", "F0326")).toBe("FEC A");
    expect(formatAccLabel("F0326 — FEC A (Reserved)")).toBe("FEC A");
    expect(formatAccLabel("FEC E  (Reserved)", "F0330")).toBe("FEC E");
  });

  it("keeps spaces in every category name", () => {
    expect(formatAccLabel("Drawing", "DRG")).toBe("Drawing");
    expect(formatAccLabel("Aeronautical Communication System", "ACS0")).toBe(
      "Aeronautical Communication System",
    );
  });
});

describe("inferAccTaxonomy", () => {
  it("decodes Accelerator positional filename tokens as full names", () => {
    const result = inferAccTaxonomy("L-AC-AE-GT-AAP08-ACS0-DRG-14221.pdf", "BIM/L-AC-AE-GT-AAP08-ACS0-DRG-14221.pdf");
    expect(result["ACC-Portfolio"]).toBe("Long Term Investment in Facilities and Terminals");
    expect(result["ACC-Program"]).toBe("Accelerator");
    expect(result["ACC-Sub Program"]).toBe("Airfield Electrical & Civil");
    expect(result["ACC-Document Type"]).toBe("Drawing");
    expect(result["ACC-Discipline"]).toBe("Aeronautical Communication System");
  });

  it("maps reserved locations to the full location name", () => {
    const result = inferAccTaxonomy("L-AC-AE-GT-F0326-ACS0-DRG-1.pdf", "docs/L-AC-AE-GT-F0326-ACS0-DRG-1.pdf");
    expect(result["ACC-Location"]).toBe("FEC A");
  });

  it("maps a non-general discipline to discipline and subdiscipline", () => {
    const result = inferAccTaxonomy("L-AC-AE-GT-AAP08-ACS1-DRG-1.pdf", "docs/L-AC-AE-GT-AAP08-ACS1-DRG-1.pdf");
    expect(result["ACC-Discipline"]).toBe("Aeronautical Communication System — Voice Communication Systems");
  });

  it("rewrites previously stored code [name] labels", () => {
    const result = inferAccTaxonomy("L-AC-AE-GT-F0326-ACS0-DRG-1.pdf", "docs/L-AC-AE-GT-F0326-ACS0-DRG-1.pdf", {
      "ACC-Sub Program": "AE [AirfieldElectrical&Civil]",
      "ACC-Location": "F0326 [FECA]",
      "ACC-Document Type": "DRG",
    });
    expect(result["ACC-Sub Program"]).toBe("Airfield Electrical & Civil");
    expect(result["ACC-Location"]).toBe("FEC A");
    expect(result["ACC-Document Type"]).toBe("Drawing");
  });

  it("maps L7 document type codes from loose tokens only for Accelerator names", () => {
    const accelerator = inferAccTaxonomy("L-AC-AE-GT-AAP08-ACS0-DRG-Sheet.pdf", "Docs/L-AC-AE-GT-AAP08-ACS0-DRG-Sheet.pdf");
    expect(accelerator["ACC-Document Type"]).toBe("Drawing");
  });

  it("only merges taxonomy metadata for ACC / Accelerator files", () => {
    expect(isAccAcceleratorNamed("L-AC-AE-GT-F0326-ACS0-DRG-1.pdf")).toBe(true);
    expect(isAccAcceleratorNamed("Harbor-Bridge-DRG-Sheet.pdf")).toBe(false);
    expect(mergeAccTaxonomyMetadata(undefined, "Harbor-Bridge-DRG-Sheet.pdf", "Docs/x.pdf")).toBeUndefined();
    const merged = mergeAccTaxonomyMetadata(undefined, "L-AC-AE-GT-F0326-ACS0-DRG-1.pdf", "docs/L-AC-AE-GT-F0326-ACS0-DRG-1.pdf");
    expect(merged?.["ACC-Location"]).toBe("FEC A");
  });
});
