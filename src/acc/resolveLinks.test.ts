import { describe, expect, it } from "vitest";
import { accMetadataDocument, pickAccFileByName, type AccNamedFile } from "@/acc/resolveLinks";
import type { FileIndex } from "@/data/types";

function hit(name: string, folderPath: string): AccNamedFile {
  return {
    name,
    entityId: `urn:${folderPath}`,
    folderUrn: `folder:${folderPath}`,
    folderPath,
  };
}

describe("pickAccFileByName", () => {
  it("matches a file that lives in a subfolder when the local path is only the file name", () => {
    const picked = pickAccFileByName("L-AC-AE-PD-ARW05-APE0-M3D-10015_3DSOLIDS-1.ifc", [
      hit("L-AC-AE-PD-ARW05-APE0-M3D-10015_3DSOLIDS-1.ifc", "Project Files/Models"),
    ]);
    expect(picked?.file.folderPath).toBe("Project Files/Models");
    expect(picked?.ambiguous).toBe(false);
  });

  it("prefers the ACC folder that matches the local parent folder", () => {
    const name = "model.ifc";
    const picked = pickAccFileByName("Runway/model.ifc", [
      hit(name, "Project Files/Other"),
      hit(name, "Project Files/Runway"),
    ]);
    expect(picked?.file.folderPath).toBe("Project Files/Runway");
    expect(picked?.ambiguous).toBe(false);
  });

  it("marks the same file name in several folders as ambiguous", () => {
    const picked = pickAccFileByName("model.ifc", [hit("model.ifc", "Project Files/A"), hit("model.ifc", "Project Files/B")]);
    expect(picked?.ambiguous).toBe(true);
  });
});

describe("accMetadataDocument", () => {
  it("writes ACC attribute names and values next to the filename fields", () => {
    const index = {
      root: { id: "root", name: "Models", nodeType: "directory", relativePath: "" },
      items: [
        {
          id: "file-1",
          name: "model.ifc",
          nodeType: "file",
          relativePath: "model.ifc",
          metadata: {
            "ACC-Discipline": "Airfield Pavement Engineering",
            Version: "C",
            accUrl: "https://acc.autodesk.com/docs",
          },
        },
      ],
    } as FileIndex;
    const document = JSON.parse(accMetadataDocument(index, { attributes: ["Version"] })) as {
      attributes: string[];
      files: Array<{ metadata: Record<string, string> }>;
    };
    expect(document.attributes).toEqual(["Version"]);
    expect(document.files[0].metadata.Version).toBe("C");
    expect(document.files[0].metadata["ACC-Discipline"]).toBe("Airfield Pavement Engineering");
  });

  it("writes each ACC version beside the size of that version", () => {
    const index = {
      items: [
        {
          id: "file-1",
          name: "model.ifc",
          nodeType: "file",
          relativePath: "model.ifc",
          metadata: {
            accVersions: [
              { version: 1, bytes: 2 * 1024 * 1024, size: "2.0 MB" },
              { version: 2, bytes: 4 * 1024 * 1024, size: "4.0 MB" },
              { version: 3, bytes: 12 * 1024 * 1024, size: "12 MB" },
            ],
            "Version 1 size": "2.0 MB",
            "Version 3 size": "12 MB",
          },
        },
      ],
    } as FileIndex;
    const document = JSON.parse(accMetadataDocument(index)) as {
      files: Array<{ versions: Array<{ version: number; size: string }>; metadata: Record<string, unknown> }>;
    };
    expect(document.files[0].versions.map((entry) => [entry.version, entry.size])).toEqual([
      [1, "2.0 MB"],
      [2, "4.0 MB"],
      [3, "12 MB"],
    ]);
    expect(document.files[0].metadata.accVersions).toBeUndefined();
    expect(document.files[0].metadata["Version 1 size"]).toBe("2.0 MB");
  });
});
