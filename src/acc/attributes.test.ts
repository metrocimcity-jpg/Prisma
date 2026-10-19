import { describe, expect, it } from "vitest";
import {
  attributeValueText,
  mergeAccSheet,
  standardAccValues,
  valuesFromCustomAttributes,
  valuesFromVersionSheet,
  versionFromTipUrn,
} from "@/acc/attributes";
import { groupingMetadataKeys } from "@/ui/layout/hierarchy";

describe("ACC attribute sheets", () => {
  it("reads the version number from a tip URN", () => {
    expect(versionFromTipUrn("urn:adsk.wipprod:fs.file:vf.abc?version=4")).toBe("4");
    expect(versionFromTipUrn(undefined)).toBeNull();
  });

  it("keeps custom attribute names and skips empty values", () => {
    expect(
      valuesFromCustomAttributes([
        { name: "Document status", value: "Issued" },
        { name: "Package", value: "  " },
        { name: "Revision", value: 2 },
        { id: 9, value: "C" },
      ], new Map([["9", "Version"]])),
    ).toEqual({
      "Document status": "Issued",
      Revision: "2",
      Version: "C",
    });
  });

  it("builds sortable fields from the ACC file record", () => {
    expect(
      standardAccValues({
        tipVersionId: "urn:adsk.wipprod:fs.file:vf.abc?version=3",
        createUserName: "Ada",
        lastModifiedUserName: "Grace",
        lastModifiedTime: "2026-06-01T00:00:00.000Z",
      }),
    ).toEqual({
      Version: "3",
      "Created By": "Ada",
      "Modified By": "Grace",
      Modified: "2026-06-01T00:00:00.000Z",
    });
  });

  it("keeps the Docs link when the data sheet is attached", () => {
    expect(mergeAccSheet({ accUrl: "https://acc.autodesk.com/docs" }, { Version: "3" })).toEqual({
      accUrl: "https://acc.autodesk.com/docs",
      Version: "3",
    });
  });

  it("uses an ACC column named Discipline on the Discipline field", () => {
    expect(mergeAccSheet({ "ACC-Discipline": "From filename" }, { Discipline: "Airfield" })).toEqual({
      "ACC-Discipline": "Airfield",
      Discipline: "Airfield",
    });
  });

  it("offers the metadata name Version in Group by and hides the link", () => {
    expect(groupingMetadataKeys(["Version", "accUrl", "Document status"])).toEqual(["Document status", "Version"]);
  });

  it("stringifies list attribute values", () => {
    expect(attributeValueText(["A", "B"])).toBe("A, B");
  });

  it("keeps an ACC column named Version ahead of the tip version number", () => {
    expect(
      valuesFromVersionSheet({
        urn: "urn:adsk.wipprod:fs.file:vf.abc?version=4",
        itemUrn: "urn:adsk.wipprod:dm.lineage:abc",
        title: "Solids",
        customAttributes: [{ name: "Version", value: "C" }],
      }),
    ).toEqual({
      Version: "C",
      Title: "Solids",
    });
  });
});
