import { describe, expect, it } from "vitest";
import { versionSizeFields, versionSizesFromNodes } from "@/acc/versions";

const MB = 1024 * 1024;

describe("versionSizesFromNodes", () => {
  it("keeps each version with its own size, oldest first", () => {
    expect(
      versionSizesFromNodes([
        { id: "urn:adsk.wipprod:fs.file:vf.abc?version=3", attributes: { versionNumber: 3, storageSize: 12 * MB } },
        { attributes: { versionNumber: 1, storageSize: 2 * MB } },
        { attributes: { versionNumber: 2, storageSize: 4 * MB } },
      ]),
    ).toEqual([
      { version: 1, bytes: 2 * MB, size: "2.0 MB" },
      { version: 2, bytes: 4 * MB, size: "4.0 MB" },
      { version: 3, bytes: 12 * MB, size: "12 MB" },
    ]);
  });
});

describe("versionSizeFields", () => {
  it("names each version size so the file can be grouped by it", () => {
    expect(
      versionSizeFields([
        { version: 1, bytes: 2 * MB, size: "2.0 MB" },
        { version: 2, bytes: 4 * MB, size: "4.0 MB" },
        { version: 3, bytes: 12 * MB, size: "12 MB" },
      ]),
    ).toEqual({
      "Version 1 size": "2.0 MB",
      "Version 2 size": "4.0 MB",
      "Version 3 size": "12 MB",
      "Version sizes": "1: 2.0 MB, 2: 4.0 MB, 3: 12 MB",
    });
  });
});
