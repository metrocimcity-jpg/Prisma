import type { PaletteId } from "./types";

export const CATEGORY_COLORS: Record<string, string> = {
  CAD: "#5eb3ff",
  BIM: "#5edede",
  GIS: "#8fd97a",
  Engineering: "#ffb454",
  Documents: "#ffd166",
  Spreadsheets: "#9ecf6f",
  Presentations: "#ff9a5e",
  PDF: "#f77e8f",
  Images: "#c896ff",
  Video: "#e0a3ff",
  Audio: "#84d8ff",
  Archives: "#7ea8ff",
  Programming: "#ffb454",
  Data: "#6bdbb0",
  Database: "#7fc9c9",
  Web: "#84d8ff",
  "3D": "#ff9a5e",
  Fonts: "#9aa1b1",
  Executables: "#ff6b9d",
  System: "#5c6376",
  Configuration: "#7ea8ff",
  Other: "#7a7f89",
  Folder: "hsla(220, 14%, 22%, 1)",
};

export const DISK_ATLAS_PALETTE = [
  "#ffb454",
  "#5eb3ff",
  "#8fd97a",
  "#ff8fb1",
  "#c896ff",
  "#5edede",
  "#ffd166",
  "#ff9a5e",
  "#7ea8ff",
  "#c4e86b",
  "#ff6b9d",
  "#6bdbb0",
  "#e0a3ff",
  "#84d8ff",
  "#ffbb7d",
  "#9ecf6f",
  "#f77e8f",
  "#7fc9c9",
];

export const FOLDER_FILL = "hsla(220, 14%, 22%, 1)";
export const UNMATCHED_FILL = "hsla(220, 8%, 30%, 0.35)";
export const MATCH_STROKE = "#59d9c4";
export const SIZE_SCALE = { from: "#4d6b99", to: "#ff8a4d" } as const;
export const DATE_SCALE = { from: "#4a4f5c", to: "#5eddc0" } as const;

const EXT_CATEGORY: Record<string, number> = {
  js: 0,
  jsx: 0,
  ts: 0,
  tsx: 0,
  mjs: 0,
  cjs: 0,
  vue: 0,
  svelte: 0,
  json: 6,
  yml: 1,
  yaml: 1,
  xml: 1,
  toml: 1,
  ini: 1,
  env: 1,
  lock: 1,
  css: 2,
  scss: 2,
  sass: 2,
  less: 2,
  html: 8,
  md: 6,
  txt: 6,
  rst: 6,
  pdf: 9,
  png: 4,
  jpg: 4,
  jpeg: 4,
  gif: 4,
  svg: 4,
  webp: 4,
  ico: 4,
  bmp: 4,
  py: 11,
  java: 11,
  go: 11,
  rs: 11,
  rb: 11,
  php: 11,
  c: 11,
  cpp: 11,
  h: 11,
  cs: 11,
  kt: 11,
  swift: 11,
  sql: 5,
  csv: 5,
  db: 5,
  sqlite: 5,
  zip: 1,
  tar: 1,
  gz: 1,
  "7z": 1,
  rar: 1,
  mp3: 10,
  wav: 10,
  mp4: 10,
  mov: 10,
  avi: 10,
  webm: 10,
  log: 1,
  gitignore: 1,
  dockerfile: 11,
  sh: 11,
  bat: 1,
  dwg: 1,
  dxf: 1,
  dgn: 1,
  rvt: 5,
  rfa: 5,
  rte: 5,
  ifc: 5,
  nwd: 5,
  nwc: 5,
  shp: 2,
  gpkg: 2,
  las: 2,
  laz: 2,
  obj: 7,
  fbx: 7,
  skp: 7,
};

export function knownExtensions(): string[] {
  return Object.keys(EXT_CATEGORY).sort();
}

export function colorForExt(ext: string | null | undefined): string {
  if (ext === null || ext === undefined || ext.length === 0 || ext === "(none)" || ext === "no extension") {
    return "#5c6376";
  }
  const key = ext.toLowerCase().replace(/^\./, "");
  const index = key in EXT_CATEGORY ? EXT_CATEGORY[key] : hashExt(key);
  return DISK_ATLAS_PALETTE[index % DISK_ATLAS_PALETTE.length];
}

function hashExt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const PALETTES: Record<PaletteId, string[]> = {
  professional: DISK_ATLAS_PALETTE,
  dark: DISK_ATLAS_PALETTE,
  light: ["#c4842a", "#2f6fed", "#2a9d8f", "#c45c5c", "#7a6ff0", "#5d9a6c", "#d0895a", "#5c6376"],
  monochrome: ["#9aa4b2", "#7d8794", "#c5ccd6", "#5c6570", "#dfe4ea", "#3e4650"],
  engineering: ["#ffb454", "#5eb3ff", "#5edede", "#f77e8f", "#8fd97a", "#c896ff"],
  bim: ["#5edede", "#5eb3ff", "#ffb454", "#c896ff", "#f77e8f", "#8fd97a"],
  cad: ["#5eb3ff", "#7ea8ff", "#84d8ff", "#ffb454", "#ff9a5e", "#9aa1b1"],
  rainbow: DISK_ATLAS_PALETTE,
  heatmap: ["#4d6b99", "#5edede", "#ffd166", "#ff9a5e", "#ff6b6b"],
  pastel: ["#9db4c0", "#c9ada7", "#a3b18a", "#e0c097", "#b8c0ff", "#ffcfd2", "#90e0ef"],
  highContrast: ["#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#ffffff", "#ff9f1c"],
};

export function paletteColors(id: PaletteId): string[] {
  return PALETTES[id];
}

export function mixHex(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return rgbToHex(r, g, bl);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((ch) => ch + ch).join("")
    : normalized;
  const n = Number.parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function lighten(hex: string, amount: number): string {
  return mixHex(hex, "#ffffff", amount);
}

export function darken(hex: string, amount: number): string {
  return mixHex(hex, "#0b0d10", amount);
}
