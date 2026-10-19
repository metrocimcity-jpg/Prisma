import { describe, expect, it } from "vitest";
import {
  accAttributeRecords,
  applyAccAttributeRecords,
  applySavedAccAttributes,
  mergeAttributeRecords,
  upsertAccAttributeDefault,
} from "@/acc/attributeCache";
import type { FileIndex } from "@/data/types";

function indexWith(
  files: Array<{ path: string; name?: string; metadata?: Record<string, unknown> }>,
  folderName = "Models",
): FileIndex {
  return {
    root: { id: "root", name: folderName, path: folderName },
    items: files.map((file, index) => ({
      id: `file-${index}`,
      name: file.name ?? file.path.split("/").pop() ?? file.path,
      nodeType: "file",
      relativePath: file.path,
      metadata: file.metadata,
    })),
  } as FileIndex;
}

describe("accAttributeRecords", () => {
  it("keeps APS columns and filename fields in the saved copy", () => {
    const records = accAttributeRecords(
      indexWith([
        {
          path: "model.ifc",
          metadata: {
            "ACC-Discipline": "Airfield",
            Version: "C",
            "Version 1 size": "2.0 MB",
            accUrl: "https://acc.autodesk.com/docs",
            accVersions: [{ version: 1, bytes: 2097152, size: "2.0 MB" }],
          },
        },
        { path: "notes.txt", metadata: { "ACC-Portfolio": "Long Term" } },
      ]),
    );
    expect(records).toEqual([
      {
        path: "model.ifc",
        name: "model.ifc",
        metadata: {
          "ACC-Discipline": "Airfield",
          Version: "C",
          "Version 1 size": "2.0 MB",
          accUrl: "https://acc.autodesk.com/docs",
        },
        versions: [{ version: 1, bytes: 2097152, size: "2.0 MB" }],
      },
      {
        path: "notes.txt",
        name: "notes.txt",
        metadata: { "ACC-Portfolio": "Long Term" },
      },
    ]);
  });
});

describe("applyAccAttributeRecords", () => {
  const saved = [
    {
      path: "Models/model.ifc",
      name: "model.ifc",
      metadata: { Version: "C", "Version 1 size": "2.0 MB" },
    },
  ];

  it("restores attributes when the same folder is loaded again", () => {
    const result = applyAccAttributeRecords(
      indexWith([{ path: "Models/model.ifc", metadata: { "ACC-Discipline": "Airfield" } }]),
      saved,
      "project-a",
      "project-a",
    );
    expect(result.applied).toBe(1);
    expect(result.index.items[0]?.metadata).toEqual({
      "ACC-Discipline": "Airfield",
      Version: "C",
      "Version 1 size": "2.0 MB",
    });
  });

  it("matches a unique file name when the local path is only the file name", () => {
    const result = applyAccAttributeRecords(indexWith([{ path: "model.ifc" }]), saved, "project-a", "");
    expect(result.applied).toBe(1);
    expect(result.index.items[0]?.metadata?.Version).toBe("C");
  });

  it("does not guess when the same file name was saved in more than one folder", () => {
    const result = applyAccAttributeRecords(indexWith([{ path: "model.ifc" }]), [
      saved[0],
      { path: "Other/model.ifc", name: "model.ifc", metadata: { Version: "B" } },
    ], "project-a", "project-a");
    expect(result.applied).toBe(0);
  });

  it("copies an ACC column named Discipline onto the Discipline field", () => {
    const result = applyAccAttributeRecords(
      indexWith([{ path: "model.ifc", metadata: { "ACC-Discipline": "From filename" } }]),
      [{ path: "model.ifc", name: "model.ifc", metadata: { Discipline: "Airfield" } }],
      "project-a",
      "project-a",
    );
    expect(result.index.items[0]?.metadata?.["ACC-Discipline"]).toBe("Airfield");
    expect(result.index.items[0]?.metadata?.Discipline).toBe("Airfield");
  });

  it("leaves files alone when the saved attributes belong to another project", () => {
    const result = applyAccAttributeRecords(indexWith([{ path: "Models/model.ifc" }]), saved, "project-a", "project-b");
    expect(result.applied).toBe(0);
    expect(result.index.items[0]?.metadata).toBeUndefined();
  });
});

describe("saved folder default", () => {
  const resolved = indexWith(
    [{ path: "model.ifc", metadata: { Version: "C", "Version 1 size": "2.0 MB" } }],
    "Runway",
  );

  it("keeps the Resolve ACC JSON as the default for that folder and project", () => {
    const saved = upsertAccAttributeDefault(null, "project-a", resolved, "2026-10-18T00:00:00.000Z");
    const loaded = applySavedAccAttributes(indexWith([{ path: "model.ifc" }], "Runway"), "project-a", saved.library);
    expect(saved.saved).toBe(1);
    expect(loaded.applied).toBe(1);
    expect(loaded.index.items[0]?.metadata?.Version).toBe("C");
  });

  it("does not apply the default when a different folder is loaded", () => {
    const saved = upsertAccAttributeDefault(null, "project-a", resolved, "2026-10-18T00:00:00.000Z");
    const loaded = applySavedAccAttributes(indexWith([{ path: "model.ifc" }], "Other"), "project-a", saved.library);
    expect(loaded.applied).toBe(0);
  });

  it("does not apply the default when a different project is signed in", () => {
    const saved = upsertAccAttributeDefault(null, "project-a", resolved, "2026-10-18T00:00:00.000Z");
    const loaded = applySavedAccAttributes(indexWith([{ path: "model.ifc" }], "Runway"), "project-b", saved.library);
    expect(loaded.applied).toBe(0);
  });

  it("matches the project id without regard to letter case", () => {
    const saved = upsertAccAttributeDefault(null, "Project-A", resolved, "2026-10-18T00:00:00.000Z");
    const loaded = applySavedAccAttributes(indexWith([{ path: "model.ifc" }], "Runway"), "project-a", saved.library);
    expect(loaded.applied).toBe(1);
    expect(loaded.index.items[0]?.metadata?.Version).toBe("C");
  });
});

describe("mergeAttributeRecords", () => {
  it("keeps earlier files and replaces a path that was read again", () => {
    expect(
      mergeAttributeRecords(
        [
          { path: "a.ifc", name: "a.ifc", metadata: { Version: "1" } },
          { path: "b.ifc", name: "b.ifc", metadata: { Version: "1" } },
        ],
        [{ path: "b.ifc", name: "b.ifc", metadata: { Version: "2" } }],
      ),
    ).toEqual([
      { path: "a.ifc", name: "a.ifc", metadata: { Version: "1" } },
      { path: "b.ifc", name: "b.ifc", metadata: { Version: "2" } },
    ]);
  });
});
