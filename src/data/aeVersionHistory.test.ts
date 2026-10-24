import { describe, expect, it } from "vitest";
import { applyAeVersionHistory, versionHistoryOf } from "@/data/aeVersionHistory";
import type { FileIndex, IndexNode } from "@/data/types";

function file(name: string, relativePath = name): IndexNode {
  return {
    id: name,
    parentId: "root",
    name,
    path: name,
    relativePath,
    nodeType: "file",
    extension: null,
    mimeType: null,
    fileType: null,
    category: null,
    subcategory: null,
    size: 1,
    createdAt: null,
    modifiedAt: null,
    accessedAt: null,
    attributes: null,
  };
}

function index(rootName: string, rootPath: string, items: IndexNode[]): FileIndex {
  return {
    schemaVersion: "1.0",
    generatedAt: "2026-10-24T00:00:00.000Z",
    generatorVersion: "0.4.0",
    root: { id: "root", name: rootName, path: rootPath },
    statistics: {
      totalFiles: items.length,
      totalFolders: 1,
      totalSize: 1,
      errorCount: 0,
      categoryCounts: {},
      extensionCounts: {},
      largestFileId: null,
      newestFileId: null,
      oldestFileId: null,
    },
    items: [{ ...file("AE"), id: "root", nodeType: "folder", name: rootName, path: rootPath, relativePath: "" }, ...items],
    errors: [],
  };
}

describe("applyAeVersionHistory", () => {
  it("attaches workbook versions when the AE folder is loaded", () => {
    const names = Array.from({ length: 8 }, () => "L-AC-AE-PD-AAP90-AES0-M2D-40001.dwg");
    const loaded = applyAeVersionHistory(
      index("AE", "C:\\Users\\g.vakili\\DC\\ACCDocs\\Mott MacDonald\\GTAA - PACT DJV\\Project Files\\2. Shared\\AE", names.map((name) => file(name))),
    );
    const history = versionHistoryOf(loaded.items.find((item) => item.name === names[0])!);
    expect(history.length).toBeGreaterThan(1);
    expect(history[0]?.version).toBe(1);
    expect(history[0]?.modifiedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("leaves an unrelated folder unchanged", () => {
    const loaded = applyAeVersionHistory(index("Notes", "C:\\temp\\Notes", [file("readme.txt")]));
    expect(loaded.items.find((item) => item.name === "readme.txt")?.metadata).toBeUndefined();
  });
});
