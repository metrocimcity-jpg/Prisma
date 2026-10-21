import type { HoverDrawProperties } from "./hover";

export interface PointerRatio {
  x: number;
  y: number;
}

interface GlowPoint {
  x: number;
  y: number;
}

interface GlowContext {
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  closePath: () => void;
  stroke: () => void;
  lineWidth: number;
  lineJoin: string;
  strokeStyle: string | CanvasGradient;
  shadowBlur: number;
  shadowColor: string;
  createRadialGradient: (x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) => CanvasGradient;
}

export interface PointerGlowProperties extends HoverDrawProperties {
  polygon?: GlowPoint[];
}

let pointer: GlowPoint | null = null;

export function setCellPointer(x: number, y: number): void {
  pointer = { x, y };
}

export function clearCellPointer(): void {
  pointer = null;
}

/** 0 at the cell center, 1 at the edge. */
export function fromCenter({ x, y }: PointerRatio): number {
  return Math.min(Math.max(0, Math.sqrt((y - 0.5) * (y - 0.5) + (x - 0.5) * (x - 0.5)) / 0.5), 1);
}

function boundsOf(polygon: GlowPoint[]): { left: number; top: number; width: number; height: number } {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of polygon) {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  }
  return { left, top, width: Math.max(right - left, 1), height: Math.max(bottom - top, 1) };
}

function canDraw(ctx: HoverDrawProperties["context"]): ctx is HoverDrawProperties["context"] & GlowContext {
  const draw = ctx as Partial<GlowContext>;
  return typeof draw.save === "function" && typeof draw.stroke === "function" && typeof draw.createRadialGradient === "function";
}

/** Blue shine that follows the pointer around the cell edge. The fill stays untouched. */
export function drawPointerGlow(properties: PointerGlowProperties): void {
  const polygon = properties.polygon;
  const spot = pointer;
  if (!properties.hovered || properties.attribution || properties.description || properties.open || !polygon || polygon.length < 3 || !spot || !canDraw(properties.context)) {
    return;
  }
  const box = boundsOf(polygon);
  const first = polygon[0];
  if (!first) {
    return;
  }
  const ctx = properties.context;
  const radius = Math.max(56, Math.min(box.width, box.height) * 0.62);
  const gradient = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, radius);
  gradient.addColorStop(0, "rgba(186, 230, 253, 0.98)");
  gradient.addColorStop(0.28, "rgba(56, 189, 248, 0.9)");
  gradient.addColorStop(0.55, "rgba(37, 99, 235, 0.45)");
  gradient.addColorStop(1, "rgba(37, 99, 235, 0)");
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < polygon.length; index += 1) {
    const point = polygon[index];
    if (point) {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, Math.min(box.width, box.height) * 0.012);
  ctx.strokeStyle = gradient;
  ctx.shadowColor = "rgba(56, 189, 248, 0.95)";
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.lineWidth = Math.max(1.4, ctx.lineWidth * 0.45);
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.restore();
}
