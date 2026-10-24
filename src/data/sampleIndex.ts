import { buildFileIndex } from "@/data/aggregate";
import type { FileIndex, RawScanEntry } from "@/data/types";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function file(relativePath: string, size: number, daysAgo: number): RawScanEntry {
  const name = relativePath.includes("/") ? relativePath.slice(relativePath.lastIndexOf("/") + 1) : relativePath;
  return {
    relativePath,
    name,
    nodeType: "file",
    size,
    createdAt: isoDaysAgo(daysAgo + 40),
    modifiedAt: isoDaysAgo(daysAgo),
    accessedAt: isoDaysAgo(Math.max(daysAgo - 3, 0)),
    attributes: {
      hidden: name.startsWith("."),
      system: false,
      readOnly: false,
      executable: false,
      symbolicLink: false,
    },
    mimeHint: null,
  };
}

function folder(relativePath: string): RawScanEntry {
  const name = relativePath.includes("/") ? relativePath.slice(relativePath.lastIndexOf("/") + 1) : relativePath;
  return {
    relativePath,
    name,
    nodeType: "folder",
    size: 0,
    createdAt: isoDaysAgo(400),
    modifiedAt: isoDaysAgo(12),
    accessedAt: isoDaysAgo(2),
    attributes: {
      hidden: false,
      system: false,
      readOnly: false,
      executable: false,
      symbolicLink: false,
    },
    mimeHint: null,
  };
}

export function createSampleIndex(): FileIndex {
  const folders = [
    "BIM",
    "BIM/Architecture",
    "BIM/Structure",
    "BIM/MEP",
    "CAD",
    "CAD/Civil",
    "CAD/Details",
    "GIS",
    "GIS/Survey",
    "Docs",
    "Docs/Specs",
    "Docs/Reports",
    "Media",
    "Media/Renders",
    "Exports",
    "Archives",
  ];

  const files: RawScanEntry[] = [
    file("BIM/Architecture/Harbor-Arch.rvt", 482_000_000, 4),
    file("BIM/Architecture/Harbor-Arch-Workset.rvt", 91_000_000, 4),
    file("BIM/Architecture/Airfield-Terminal.rvt", 8_400_000, 21),
    file("BIM/Architecture/Airfield-Apron.rvt", 11_200_000, 8),
    file("BIM/Architecture/Airfield-Tower.rvt", 6_100_000, 26),
    file("BIM/Architecture/Airfield-Cargo.rvt", 9_800_000, 55),
    file("BIM/Architecture/CurtainWall.rfa", 12_400_000, 18),
    file("BIM/Architecture/Door-Type-A.rfa", 3_200_000, 40),
    file("BIM/Architecture/Site.rte", 28_000_000, 90),
    file("BIM/Structure/Harbor-STR.rvt", 310_000_000, 6),
    file("BIM/Structure/Steel-Connection.rfa", 6_800_000, 21),
    file("BIM/MEP/Harbor-MEP.rvt", 188_000_000, 5),
    file("BIM/MEP/AHU-Type-B.rfa", 4_100_000, 33),
    file("BIM/Coordination/Harbor.nwd", 740_000_000, 2),
    file("BIM/Coordination/Harbor.nwc", 95_000_000, 2),
    file("BIM/Exchange/Harbor.ifc", 64_000_000, 3),
    folder("BIM/Coordination"),
    folder("BIM/Exchange"),
    file("CAD/Civil/Alignment-Main.dwg", 42_000_000, 7),
    file("CAD/Civil/Alignment-Main.dxf", 18_000_000, 7),
    file("CAD/Civil/Bridge-Deck.dwg", 27_500_000, 9),
    file("CAD/Civil/Existing-Topo.dwg", 88_000_000, 55),
    file("CAD/Details/Abutment.dwg", 6_200_000, 14),
    file("CAD/Details/Pier-Cap.dwg", 5_400_000, 14),
    file("CAD/Details/Standard.dwt", 1_100_000, 200),
    file("CAD/Sheets/G-001.dwg", 8_800_000, 3),
    file("CAD/Sheets/S-101.dwg", 9_400_000, 3),
    file("CAD/Sheets/A-201.dwg", 11_200_000, 3),
    folder("CAD/Sheets"),
    file("GIS/Survey/control.shp", 2_200_000, 70),
    file("GIS/Survey/control.shx", 120_000, 70),
    file("GIS/Survey/control.dbf", 340_000, 70),
    file("GIS/Survey/points.las", 420_000_000, 20),
    file("GIS/Survey/points.laz", 86_000_000, 20),
    file("GIS/base.gpkg", 54_000_000, 28),
    file("GIS/site.kml", 240_000, 12),
    file("Docs/Specs/Structural-Spec.docx", 1_800_000, 11),
    file("Docs/Specs/Architectural-Spec.docx", 2_400_000, 11),
    file("Docs/Reports/Geotech.pdf", 18_600_000, 80),
    file("Docs/Reports/Traffic-Study.pdf", 9_200_000, 64),
    file("Docs/Reports/Cost-Plan.xlsx", 1_100_000, 8),
    file("Docs/Meeting-Notes.md", 24_000, 1),
    file("Media/Renders/hero.png", 14_000_000, 6),
    file("Media/Renders/night.jpg", 8_400_000, 6),
    file("Media/animation.mp4", 260_000_000, 15),
    file("Exports/IFC/Harbor-Arch.ifc", 41_000_000, 3),
    file("Exports/3D/bridge.obj", 33_000_000, 10),
    file("Exports/3D/bridge.fbx", 47_000_000, 10),
    folder("Exports/IFC"),
    folder("Exports/3D"),
    file("Archives/2025-Q4.zip", 1_250_000_000, 120),
    file("Archives/issued-for-tender.7z", 640_000_000, 45),
    file(".gitignore", 180, 200),
  ];

  const entries = [...folders.map(folder), ...files];
  const index = buildFileIndex({
    rootName: "Harbor-Bridge",
    rootPath: "Harbor-Bridge",
    entries,
    generatedAt: new Date().toISOString(),
  });

  const documentMeta: Record<string, Record<string, string | number>> = {
    "BIM/Architecture/Harbor-Arch.rvt": {
      firstLevelLocation: "F0326",
      discipline: "ELEO",
      documentType: "M3D",
      sequenceNumber: 10002,
      projectNumber: "AE02",
      projectLocation: "FEC A",
      designStage: "IFC",
      securityClassification: "Internal",
      documentAuthor: "Oluwatobi OLUMUYIWA",
      documentCreationDate: "2026-06-26",
      documentTitle: "FEC A Building - Electrical Model",
      previousFileName: "L-AC-AE-PD-B52-ELEO-M3D-10002",
      accUrl:
        "https://acc.autodesk.com/docs/files/projects/00000000-0000-0000-0000-000000000001?folderUrn=urn%3Aadsk.wipprod%3Afs.folder%3Aco.sample&entityId=urn%3Aadsk.wipprod%3Adm.lineage%3AsampleArch",
    },
    "BIM/Architecture/Airfield-Terminal.rvt": {
      firstLevelLocation: "AF01",
      discipline: "ARCH",
      documentType: "M3D",
      sequenceNumber: 11021,
      projectNumber: "AF-01",
      projectLocation: "Airfield",
      designStage: "IFC",
      securityClassification: "Internal",
      documentAuthor: "Prisma Sample",
      documentCreationDate: "2026-09-01",
      documentTitle: "Airfield Terminal - Architectural Model",
      previousFileName: "AF-ARCH-M3D-11021",
    },
    "BIM/Architecture/Airfield-Apron.rvt": {
      firstLevelLocation: "AF01",
      discipline: "ARCH",
      documentType: "M3D",
      projectLocation: "Airfield",
      documentTitle: "Airfield Apron - Architectural Model",
    },
    "BIM/Architecture/Airfield-Tower.rvt": {
      firstLevelLocation: "AF01",
      discipline: "ARCH",
      documentType: "M3D",
      projectLocation: "Airfield",
      documentTitle: "Airfield Tower - Architectural Model",
    },
    "BIM/Architecture/Airfield-Cargo.rvt": {
      firstLevelLocation: "AF01",
      discipline: "ARCH",
      documentType: "M3D",
      projectLocation: "Airfield",
      documentTitle: "Airfield Cargo - Architectural Model (older)",
    },
    "BIM/Structure/Harbor-STR.rvt": {
      firstLevelLocation: "F0327",
      discipline: "ELEO",
      documentType: "M3D",
      sequenceNumber: 20003,
      projectNumber: "AE03",
      projectLocation: "FEC B",
      designStage: "IFC",
      securityClassification: "Internal",
      documentAuthor: "Oluwatobi OLUMUYIWA",
      documentCreationDate: "2025-12-15",
      documentTitle: "FEC B Building - Electrical Model",
      previousFileName: "L-AC-AE-PD-B52-ELEO-M3D-20003",
    },
    "BIM/MEP/Harbor-MEP.rvt": {
      firstLevelLocation: "F0328",
      discipline: "ELEO",
      documentType: "M3D",
      sequenceNumber: 30004,
      projectNumber: "AE04",
      projectLocation: "FEC C",
      designStage: "IFC",
      securityClassification: "Internal",
      documentAuthor: "Oluwatobi OLUMUYIWA",
      documentCreationDate: "2026-06-08",
      documentTitle: "FEC C Building - Electrical Model",
      previousFileName: "L-AC-AE-PD-B52-ELEO-M3D-30004",
    },
  };

  return {
    ...index,
    items: index.items.map((item) => {
      const meta = documentMeta[item.relativePath];
      return meta ? { ...item, metadata: meta } : item;
    }),
  };
}
