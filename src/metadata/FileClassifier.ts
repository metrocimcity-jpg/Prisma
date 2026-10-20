import type { FileCategory } from "@/data/types";

export interface Classification {
  extension: string | null;
  mimeType: string | null;
  fileType: string | null;
  category: FileCategory | null;
  subcategory: string | null;
}

export interface FileClassifier {
  classify(input: { name: string; mimeHint?: string | null; nodeType: "file" | "folder" }): Classification;
}

interface ExtensionRule {
  extension: string;
  mimeType: string | null;
  fileType: string;
  category: FileCategory;
  subcategory: string;
}

const EXTENSION_RULES: ExtensionRule[] = [
  { extension: "dwg", mimeType: "image/vnd.dwg", fileType: "AutoCAD Drawing", category: "CAD", subcategory: "Drawing" },
  { extension: "dxf", mimeType: "image/vnd.dxf", fileType: "Drawing Exchange", category: "CAD", subcategory: "Exchange" },
  { extension: "dgn", mimeType: null, fileType: "MicroStation Design", category: "CAD", subcategory: "Drawing" },
  { extension: "dwt", mimeType: null, fileType: "AutoCAD Template", category: "CAD", subcategory: "Template" },
  { extension: "dwf", mimeType: "model/vnd.dwf", fileType: "Design Web Format", category: "CAD", subcategory: "Publish" },
  { extension: "rvt", mimeType: null, fileType: "Revit Model", category: "BIM", subcategory: "Model" },
  { extension: "rfa", mimeType: null, fileType: "Revit Family", category: "BIM", subcategory: "Family" },
  { extension: "rte", mimeType: null, fileType: "Revit Template", category: "BIM", subcategory: "Template" },
  { extension: "rft", mimeType: null, fileType: "Revit Family Template", category: "BIM", subcategory: "Template" },
  { extension: "ifc", mimeType: "application/x-step", fileType: "IFC Model", category: "BIM", subcategory: "Exchange" },
  { extension: "nwd", mimeType: null, fileType: "Navisworks Document", category: "BIM", subcategory: "Coordination" },
  { extension: "nwc", mimeType: null, fileType: "Navisworks Cache", category: "BIM", subcategory: "Coordination" },
  { extension: "nwf", mimeType: null, fileType: "Navisworks Set", category: "BIM", subcategory: "Coordination" },
  { extension: "shp", mimeType: "application/x-shapefile", fileType: "Shapefile", category: "GIS", subcategory: "Vector" },
  { extension: "shx", mimeType: null, fileType: "Shapefile Index", category: "GIS", subcategory: "Vector" },
  { extension: "dbf", mimeType: "application/x-dbf", fileType: "dBASE Table", category: "GIS", subcategory: "Attribute" },
  { extension: "gpkg", mimeType: "application/geopackage+sqlite3", fileType: "GeoPackage", category: "GIS", subcategory: "Database" },
  { extension: "gdb", mimeType: null, fileType: "File Geodatabase", category: "GIS", subcategory: "Database" },
  { extension: "kml", mimeType: "application/vnd.google-earth.kml+xml", fileType: "KML", category: "GIS", subcategory: "Markup" },
  { extension: "kmz", mimeType: "application/vnd.google-earth.kmz", fileType: "KMZ", category: "GIS", subcategory: "Markup" },
  { extension: "geojson", mimeType: "application/geo+json", fileType: "GeoJSON", category: "GIS", subcategory: "Vector" },
  { extension: "las", mimeType: null, fileType: "LAS Point Cloud", category: "GIS", subcategory: "Point Cloud" },
  { extension: "laz", mimeType: null, fileType: "LAZ Point Cloud", category: "GIS", subcategory: "Point Cloud" },
  { extension: "tif", mimeType: "image/tiff", fileType: "GeoTIFF / TIFF", category: "GIS", subcategory: "Raster" },
  { extension: "tiff", mimeType: "image/tiff", fileType: "GeoTIFF / TIFF", category: "GIS", subcategory: "Raster" },
  { extension: "csv", mimeType: "text/csv", fileType: "CSV Table", category: "Data", subcategory: "Table" },
  { extension: "xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileType: "Excel Spreadsheet", category: "Spreadsheets", subcategory: "Workbook" },
  { extension: "xls", mimeType: "application/vnd.ms-excel", fileType: "Excel Spreadsheet", category: "Spreadsheets", subcategory: "Workbook" },
  { extension: "ods", mimeType: "application/vnd.oasis.opendocument.spreadsheet", fileType: "OpenDocument Spreadsheet", category: "Spreadsheets", subcategory: "Workbook" },
  { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileType: "Word Document", category: "Documents", subcategory: "Document" },
  { extension: "doc", mimeType: "application/msword", fileType: "Word Document", category: "Documents", subcategory: "Document" },
  { extension: "rtf", mimeType: "application/rtf", fileType: "Rich Text", category: "Documents", subcategory: "Document" },
  { extension: "txt", mimeType: "text/plain", fileType: "Plain Text", category: "Documents", subcategory: "Text" },
  { extension: "md", mimeType: "text/markdown", fileType: "Markdown", category: "Documents", subcategory: "Text" },
  { extension: "pdf", mimeType: "application/pdf", fileType: "PDF Document", category: "PDF", subcategory: "Document" },
  { extension: "pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", fileType: "PowerPoint", category: "Presentations", subcategory: "Deck" },
  { extension: "ppt", mimeType: "application/vnd.ms-powerpoint", fileType: "PowerPoint", category: "Presentations", subcategory: "Deck" },
  { extension: "jpg", mimeType: "image/jpeg", fileType: "JPEG Image", category: "Images", subcategory: "Raster" },
  { extension: "jpeg", mimeType: "image/jpeg", fileType: "JPEG Image", category: "Images", subcategory: "Raster" },
  { extension: "png", mimeType: "image/png", fileType: "PNG Image", category: "Images", subcategory: "Raster" },
  { extension: "gif", mimeType: "image/gif", fileType: "GIF Image", category: "Images", subcategory: "Raster" },
  { extension: "webp", mimeType: "image/webp", fileType: "WebP Image", category: "Images", subcategory: "Raster" },
  { extension: "svg", mimeType: "image/svg+xml", fileType: "SVG Image", category: "Images", subcategory: "Vector" },
  { extension: "bmp", mimeType: "image/bmp", fileType: "Bitmap Image", category: "Images", subcategory: "Raster" },
  { extension: "mp4", mimeType: "video/mp4", fileType: "MP4 Video", category: "Video", subcategory: "Video" },
  { extension: "mov", mimeType: "video/quicktime", fileType: "QuickTime Video", category: "Video", subcategory: "Video" },
  { extension: "avi", mimeType: "video/x-msvideo", fileType: "AVI Video", category: "Video", subcategory: "Video" },
  { extension: "mkv", mimeType: "video/x-matroska", fileType: "Matroska Video", category: "Video", subcategory: "Video" },
  { extension: "mp3", mimeType: "audio/mpeg", fileType: "MP3 Audio", category: "Audio", subcategory: "Audio" },
  { extension: "wav", mimeType: "audio/wav", fileType: "WAV Audio", category: "Audio", subcategory: "Audio" },
  { extension: "flac", mimeType: "audio/flac", fileType: "FLAC Audio", category: "Audio", subcategory: "Audio" },
  { extension: "zip", mimeType: "application/zip", fileType: "ZIP Archive", category: "Archives", subcategory: "Archive" },
  { extension: "7z", mimeType: "application/x-7z-compressed", fileType: "7-Zip Archive", category: "Archives", subcategory: "Archive" },
  { extension: "rar", mimeType: "application/vnd.rar", fileType: "RAR Archive", category: "Archives", subcategory: "Archive" },
  { extension: "tar", mimeType: "application/x-tar", fileType: "TAR Archive", category: "Archives", subcategory: "Archive" },
  { extension: "gz", mimeType: "application/gzip", fileType: "Gzip Archive", category: "Archives", subcategory: "Archive" },
  { extension: "js", mimeType: "text/javascript", fileType: "JavaScript", category: "Programming", subcategory: "Source" },
  { extension: "ts", mimeType: "text/typescript", fileType: "TypeScript", category: "Programming", subcategory: "Source" },
  { extension: "tsx", mimeType: "text/tsx", fileType: "TypeScript React", category: "Programming", subcategory: "Source" },
  { extension: "jsx", mimeType: "text/jsx", fileType: "JavaScript React", category: "Programming", subcategory: "Source" },
  { extension: "py", mimeType: "text/x-python", fileType: "Python", category: "Programming", subcategory: "Source" },
  { extension: "dyn", mimeType: null, fileType: "Dynamo Graph", category: "Programming", subcategory: "Visual" },
  { extension: "dyf", mimeType: null, fileType: "Dynamo Custom Node", category: "Programming", subcategory: "Visual" },
  { extension: "cs", mimeType: "text/x-csharp", fileType: "C#", category: "Programming", subcategory: "Source" },
  { extension: "cpp", mimeType: "text/x-c++src", fileType: "C++", category: "Programming", subcategory: "Source" },
  { extension: "c", mimeType: "text/x-csrc", fileType: "C", category: "Programming", subcategory: "Source" },
  { extension: "java", mimeType: "text/x-java-source", fileType: "Java", category: "Programming", subcategory: "Source" },
  { extension: "go", mimeType: "text/x-go", fileType: "Go", category: "Programming", subcategory: "Source" },
  { extension: "rs", mimeType: "text/x-rustsrc", fileType: "Rust", category: "Programming", subcategory: "Source" },
  { extension: "json", mimeType: "application/json", fileType: "JSON", category: "Data", subcategory: "Structured" },
  { extension: "xml", mimeType: "application/xml", fileType: "XML", category: "Data", subcategory: "Structured" },
  { extension: "yml", mimeType: "text/yaml", fileType: "YAML", category: "Configuration", subcategory: "Config" },
  { extension: "yaml", mimeType: "text/yaml", fileType: "YAML", category: "Configuration", subcategory: "Config" },
  { extension: "toml", mimeType: "application/toml", fileType: "TOML", category: "Configuration", subcategory: "Config" },
  { extension: "ini", mimeType: "text/plain", fileType: "INI Config", category: "Configuration", subcategory: "Config" },
  { extension: "cfg", mimeType: "text/plain", fileType: "Config File", category: "Configuration", subcategory: "Config" },
  { extension: "sql", mimeType: "application/sql", fileType: "SQL Script", category: "Database", subcategory: "Script" },
  { extension: "sqlite", mimeType: "application/vnd.sqlite3", fileType: "SQLite Database", category: "Database", subcategory: "Database" },
  { extension: "db", mimeType: "application/vnd.sqlite3", fileType: "Database File", category: "Database", subcategory: "Database" },
  { extension: "html", mimeType: "text/html", fileType: "HTML", category: "Web", subcategory: "Markup" },
  { extension: "css", mimeType: "text/css", fileType: "CSS", category: "Web", subcategory: "Style" },
  { extension: "obj", mimeType: "model/obj", fileType: "Wavefront OBJ", category: "3D", subcategory: "Mesh" },
  { extension: "fbx", mimeType: "model/fbx", fileType: "FBX Model", category: "3D", subcategory: "Mesh" },
  { extension: "3ds", mimeType: null, fileType: "3DS Model", category: "3D", subcategory: "Mesh" },
  { extension: "skp", mimeType: null, fileType: "SketchUp Model", category: "3D", subcategory: "Model" },
  { extension: "gltf", mimeType: "model/gltf+json", fileType: "glTF Model", category: "3D", subcategory: "Mesh" },
  { extension: "glb", mimeType: "model/gltf-binary", fileType: "glTF Binary", category: "3D", subcategory: "Mesh" },
  { extension: "stl", mimeType: "model/stl", fileType: "STL Mesh", category: "3D", subcategory: "Mesh" },
  { extension: "ttf", mimeType: "font/ttf", fileType: "TrueType Font", category: "Fonts", subcategory: "Font" },
  { extension: "otf", mimeType: "font/otf", fileType: "OpenType Font", category: "Fonts", subcategory: "Font" },
  { extension: "woff", mimeType: "font/woff", fileType: "WOFF Font", category: "Fonts", subcategory: "Font" },
  { extension: "woff2", mimeType: "font/woff2", fileType: "WOFF2 Font", category: "Fonts", subcategory: "Font" },
  { extension: "exe", mimeType: "application/vnd.microsoft.portable-executable", fileType: "Windows Executable", category: "Executables", subcategory: "Binary" },
  { extension: "dll", mimeType: "application/vnd.microsoft.portable-executable", fileType: "Dynamic Library", category: "Executables", subcategory: "Library" },
  { extension: "bat", mimeType: "application/x-bat", fileType: "Batch Script", category: "Executables", subcategory: "Script" },
  { extension: "ps1", mimeType: "application/x-powershell", fileType: "PowerShell Script", category: "Executables", subcategory: "Script" },
  { extension: "sh", mimeType: "application/x-sh", fileType: "Shell Script", category: "Executables", subcategory: "Script" },
  { extension: "sys", mimeType: null, fileType: "System File", category: "System", subcategory: "System" },
  { extension: "lnk", mimeType: "application/x-ms-shortcut", fileType: "Shortcut", category: "System", subcategory: "Link" },
];

const RULE_BY_EXTENSION = new Map(EXTENSION_RULES.map((rule) => [rule.extension, rule]));

export function extensionFromName(name: string): string | null {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return null;
  }
  return name.slice(lastDot + 1).toLowerCase();
}

export class DefaultFileClassifier implements FileClassifier {
  classify(input: { name: string; mimeHint?: string | null; nodeType: "file" | "folder" }): Classification {
    if (input.nodeType === "folder") {
      return {
        extension: null,
        mimeType: null,
        fileType: "Folder",
        category: null,
        subcategory: null,
      };
    }

    const extension = extensionFromName(input.name);
    if (extension === null) {
      return {
        extension: null,
        mimeType: input.mimeHint && input.mimeHint.length > 0 ? input.mimeHint : null,
        fileType: null,
        category: "Other",
        subcategory: null,
      };
    }

    const rule = RULE_BY_EXTENSION.get(extension);
    if (!rule) {
      return {
        extension,
        mimeType: input.mimeHint && input.mimeHint.length > 0 ? input.mimeHint : null,
        fileType: null,
        category: "Other",
        subcategory: null,
      };
    }

    return {
      extension,
      mimeType: input.mimeHint && input.mimeHint.length > 0 ? input.mimeHint : rule.mimeType,
      fileType: rule.fileType,
      category: rule.category,
      subcategory: rule.subcategory,
    };
  }
}

export const defaultClassifier = new DefaultFileClassifier();
