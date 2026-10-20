/** How much a hovered cell grows, from its own center. The outline stays the same. */
export const HOVER_SCALE = 1.08;

interface Hsl {
  h: number;
  s: number;
  l: number;
  a: number;
}

export interface HoverColorState {
  hovered?: boolean;
  group?: object;
}

export interface HoverColorVariables {
  groupColor: unknown;
  labelColor: string;
}

export interface HoverCellState {
  hovered?: boolean;
  open?: boolean;
  attribution?: boolean;
  description?: boolean;
}

const hoverFills = new WeakMap<object, string>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsl(r: number, g: number, b: number, a: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: lightness * 100, a };
  }
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;
  if (max === rn) {
    hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    hue = (bn - rn) / delta + 2;
  } else {
    hue = (rn - gn) / delta + 4;
  }
  return { h: hue * 60, s: saturation * 100, l: lightness * 100, a };
}

function readHsl(input: unknown): Hsl | null {
  if (typeof input === "string") {
    return readHslString(input.trim());
  }
  if (!input || typeof input !== "object") {
    return null;
  }
  const color = input as Record<string, unknown>;
  if (typeof color.h === "number" && typeof color.s === "number" && typeof color.l === "number") {
    return {
      h: color.h,
      s: color.s,
      l: color.l,
      a: typeof color.a === "number" ? color.a : 1,
    };
  }
  if (typeof color.r === "number" && typeof color.g === "number" && typeof color.b === "number") {
    return rgbToHsl(color.r, color.g, color.b, typeof color.a === "number" ? color.a : 1);
  }
  return null;
}

function readHslString(value: string): Hsl | null {
  const hsl = value.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (hsl) {
    return {
      h: Number(hsl[1]),
      s: Number(hsl[2]),
      l: Number(hsl[3]),
      a: hsl[4] === undefined ? 1 : Number(hsl[4]),
    };
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgb) {
    return rgbToHsl(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4]));
  }
  const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!hex) {
    return null;
  }
  const raw = hex[1] ?? "";
  const full = raw.length === 3 ? raw.split("").map((channel) => channel + channel).join("") : raw;
  return rgbToHsl(
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
    1,
  );
}

function formatHsl(color: Hsl): string {
  return `hsla(${Math.round(color.h)}, ${Math.round(color.s)}%, ${Math.round(color.l)}%, ${color.a})`;
}

/**
 * Same hue as the cell's current color, with more pigment.
 * Neutral grays stay neutral and only get deeper.
 */
export function boldenColor(input: unknown): string {
  const hsl = readHsl(input);
  if (!hsl) {
    return typeof input === "string" ? input : "hsla(0, 0%, 50%, 1)";
  }
  if (hsl.s < 8) {
    return formatHsl({ ...hsl, l: clamp(hsl.l - 10, 8, 92) });
  }
  return formatHsl({
    ...hsl,
    s: clamp(hsl.s + 18, 0, 100),
    l: hsl.l > 35 ? clamp(hsl.l - 7, 16, 100) : hsl.l,
  });
}

export function hoverGrowsCell(
  stacking: string | undefined,
  group: { groups?: unknown[] } | undefined,
  state: HoverCellState,
): boolean {
  if (!state.hovered || state.open || state.attribution || state.description || !group) {
    return false;
  }
  const hasChildren = Array.isArray(group.groups) && group.groups.length > 0;
  return stacking === "flattened" || !hasChildren;
}

export function applyHoverColor(state: HoverColorState, variables: HoverColorVariables): void {
  if (!state.hovered || !state.group) {
    return;
  }
  const bold = boldenColor(variables.groupColor);
  variables.groupColor = bold;
  variables.labelColor = "auto";
  hoverFills.set(state.group, bold);
}

interface DrawContext {
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  scale: (x: number, y: number) => void;
  beginPath: () => void;
  closePath: () => void;
  fill: () => void;
  fillStyle: string;
}

export interface HoverDrawProperties extends HoverCellState {
  polygonCenterX: number;
  polygonCenterY: number;
  polygonContext?: { replay: (ctx: DrawContext) => void };
  context: DrawContext;
  group?: { groups?: unknown[] };
}

export function drawHoveredCell(
  stacking: string | undefined,
  properties: HoverDrawProperties,
): void {
  if (!hoverGrowsCell(stacking, properties.group, properties) || !properties.polygonContext) {
    return;
  }
  const color = properties.group ? hoverFills.get(properties.group) : undefined;
  if (!color) {
    return;
  }
  const ctx = properties.context;
  if (typeof ctx.save !== "function" || typeof ctx.scale !== "function") {
    return;
  }
  ctx.save();
  ctx.translate(properties.polygonCenterX, properties.polygonCenterY);
  ctx.scale(HOVER_SCALE, HOVER_SCALE);
  ctx.translate(-properties.polygonCenterX, -properties.polygonCenterY);
  ctx.beginPath();
  properties.polygonContext.replay(ctx);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}
