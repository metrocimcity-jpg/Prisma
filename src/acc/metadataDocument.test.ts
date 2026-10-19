import { describe, expect, it } from "vitest";
import gtaaAccMetadata from "@/acc/defaults/GTAA.acc-metadata.json";
import { applySavedAccAttributes, rememberAccMetadataDocument } from "@/acc/attributeCache";
import { parseAccMetadataDocument } from "@/acc/metadataDocument";
import type { FileIndex } from "@/data/types";

function indexWith(files: string[], folderName: string): FileIndex {
  return {
    root: { id: "root", name: folderName, path: folderName },
    items: files.map((path, index) => ({
      id: `file-${index}`,
      name: path.split("/").pop() ?? path,
      nodeType: "file",
      relativePath: path,
    })),
  } as FileIndex;
}

describe("parseAccMetadataDocument", () => {
  it("reads the Resolve ACC download, including version sizes", () => {
    const document = parseAccMetadataDocument({
      attributes: ["Version", "Created By"],
      files: [
        {
          path: "model.ifc",
          name: "model.ifc",
          versions: [{ version: 1, bytes: 2097152, size: "2.0 MB" }],
          metadata: {
            accUrl: "https://acc.autodesk.com/docs/files/projects/2a6ebc1e-32d9-48d3-9a0e-b55c8d292e8c",
            Version: "3",
            "Created By": "Ada",
          },
        },
      ],
    });
    expect(document?.projectId).toBe("2a6ebc1e-32d9-48d3-9a0e-b55c8d292e8c");
    expect(document?.files[0]?.metadata.Version).toBe("3");
    expect(document?.files[0]?.versions?.[0]?.size).toBe("2.0 MB");
  });

  it("leaves a Prisma index alone", () => {
    expect(parseAccMetadataDocument({ schemaVersion: 1, root: { name: "GTAA" }, items: [] })).toBeNull();
  });
});

describe("GTAA.acc-metadata (4).json", () => {
  it("is the default for the GTAA folder and that project", () => {
    rememberAccMetadataDocument(gtaaAccMetadata, "GTAA", "2026-10-18T15:59:46.000Z");
    const loaded = applySavedAccAttributes(
      indexWith(["FG_ARW05_DD.xml", "Project2_FAPGN_SIGNS_V00002.rvt"], "GTAA"),
      "2a6ebc1e-32d9-48d3-9a0e-b55c8d292e8c",
    );
    expect(loaded.applied).toBe(2);
    expect(loaded.index.items[0]?.metadata?.Version).toBe("1");
    expect(loaded.index.items[0]?.metadata?.["Created By"]).toBe("Aziz SALMAN");
    expect(loaded.index.items[0]?.metadata?.["Version 1 size"]).toBe("158 MB");
    expect(loaded.index.items[1]?.metadata?.Version).toBeTruthy();
  });
});
