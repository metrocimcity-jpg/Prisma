import { describe, expect, it } from "vitest";
import { buildFileIndex } from "@/data/aggregate";
import type { RawScanEntry } from "@/data/types";
import { parseSemanticIntent } from "@/search/semanticIntent";
import { enrichIntentWithIndexMetadata } from "@/search/semanticMetadata";
import { searchSemantic } from "@/search/semanticSearch";

function aeLikeIndex() {
  const files: RawScanEntry[] = [
    {
      relativePath: "AE/L-AC-AE-PD-ARW05-ELE7-M3D-10015.rvt",
      name: "L-AC-AE-PD-ARW05-ELE7-M3D-10015.rvt",
      nodeType: "file",
      size: 12_000_000,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      attributes: { hidden: false, system: false, readOnly: false, executable: false, symbolicLink: false },
      mimeHint: null,
    },
    {
      relativePath: "AE/L-AC-AE-PD-ARW05-APE0-DRG-20001.dwg",
      name: "L-AC-AE-PD-ARW05-APE0-DRG-20001.dwg",
      nodeType: "file",
      size: 4_000_000,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      attributes: { hidden: false, system: false, readOnly: false, executable: false, symbolicLink: false },
      mimeHint: null,
    },
    {
      relativePath: "AE/L-AC-AE-PD-FAPGN-CIV8-M3D-30001.rvt",
      name: "L-AC-AE-PD-FAPGN-CIV8-M3D-30001.rvt",
      nodeType: "file",
      size: 9_000_000,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      attributes: { hidden: false, system: false, readOnly: false, executable: false, symbolicLink: false },
      mimeHint: null,
    },
  ];
  const index = buildFileIndex({
    rootName: "AE",
    rootPath: "AE",
    entries: files,
    generatedAt: new Date().toISOString(),
  });
  const meta: Record<string, Record<string, string>> = {
    "AE/L-AC-AE-PD-ARW05-ELE7-M3D-10015.rvt": {
      "ACC-Portfolio": "L [LongTermInvestmentinFacilitiesandTerminals]",
      "ACC-Program": "AC [Accelerator]",
      "ACC-Sub Program": "AE [AirfieldElectrical&Civil]",
      "ACC-Originator": "PD [PACT]",
      "ACC-Location": "ARW05 [RUNWAY05-23]",
      "ACC-Discipline": "ELE7 [ElectricalandEmergencyPowerComplianceandregulatory]",
      "ACC-Document Type": "M3D [Model-3D]",
    },
    "AE/L-AC-AE-PD-ARW05-APE0-DRG-20001.dwg": {
      "ACC-Portfolio": "L [LongTermInvestmentinFacilitiesandTerminals]",
      "ACC-Program": "AC [Accelerator]",
      "ACC-Sub Program": "AE [AirfieldElectrical&Civil]",
      "ACC-Originator": "PD [PACT]",
      "ACC-Location": "ARW05 [RUNWAY05-23]",
      "ACC-Discipline": "APE0 [AirfieldPavementEngineering]",
      "ACC-Document Type": "DRG [Drawing]",
    },
    "AE/L-AC-AE-PD-FAPGN-CIV8-M3D-30001.rvt": {
      "ACC-Portfolio": "L [LongTermInvestmentinFacilitiesandTerminals]",
      "ACC-Program": "AC [Accelerator]",
      "ACC-Sub Program": "AE [AirfieldElectrical&Civil]",
      "ACC-Originator": "PD [PACT]",
      "ACC-Location": "FAPGN [AIRPORTWIDE-GENERAL]",
      "ACC-Discipline": "CIV8 [CivilandSiteStructuralInterfaceandCoordination]",
      "ACC-Document Type": "M3D [Model-3D]",
    },
  };
  return {
    ...index,
    items: index.items.map((item) => {
      const row = meta[item.relativePath];
      return row ? { ...item, metadata: row } : item;
    }),
  };
}

describe("AE.index.json metadata semantic search", () => {
  it("matches ACC-Discipline electrical revit models from catalog metadata", () => {
    const index = aeLikeIndex();
    const result = searchSemantic(index, "electrical revit models");
    expect(result.hits.map((hit) => hit.node.name)).toEqual(["L-AC-AE-PD-ARW05-ELE7-M3D-10015.rvt"]);
    expect(result.intent.metadataFilters.some((filter) => filter.keys.includes("ACC-Discipline"))).toBe(true);
  });

  it("matches ACC-Location runway and ACC-Document Type drawings", () => {
    const index = aeLikeIndex();
    const runway = searchSemantic(index, "runway 05 dwg");
    expect(runway.hits.some((hit) => hit.node.name.includes("ARW05"))).toBe(true);

    const drawings = searchSemantic(index, "drawings ACC-Location=ARW05");
    expect(drawings.hits.map((hit) => hit.node.name)).toEqual(["L-AC-AE-PD-ARW05-APE0-DRG-20001.dwg"]);
  });

  it("matches explicit ACC metadata equals syntax", () => {
    const index = aeLikeIndex();
    const intent = enrichIntentWithIndexMetadata(
      parseSemanticIntent("rvt ACC-Discipline=ELE7"),
      index,
      "rvt ACC-Discipline=ELE7",
    );
    expect(intent.metadataFilters.length).toBeGreaterThan(0);
    const result = searchSemantic(index, "rvt ACC-Discipline=ELE7");
    expect(result.hits).toHaveLength(1);
    expect(String(result.hits[0].node.metadata?.["ACC-Discipline"])).toContain("ELE7");
  });
});
