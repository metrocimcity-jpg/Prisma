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

function canDraw(ctx: HoverDrawProperties["context"]): ctx is HoverDrawProperties["context"] & GlowContext {
  const draw = ctx as Partial<GlowContext>;
  return typeof draw.save === "function" && typeof draw.stroke === "function" && typeof draw.createRadialGradient === "function";
}

function trace(ctx: GlowContext, polygon: GlowPoint[]): void {
  const first = polygon[0];
  if (!first) {
    return;
  }
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index < polygon.length; index += 1) {
    const point = polygon[index];
    if (point) {
      ctx.lineTo(point.x, point.y);
    }
  }
  ctx.closePath();
}

/** Thin blue line on the cell edge. Brightest beside the pointer. The fill stays solid. */
export function drawPointerGlow(properties: PointerGlowProperties): void {
  const polygon = properties.polygon;
  const spot = pointer;
  if (!properties.hovered || properties.attribution || properties.description || properties.open || !polygon || polygon.length < 3 || !spot || !canDraw(properties.context)) {
    return;
  }
  const ctx = properties.context;
  let farthest = 1;
  for (const point of polygon) {
    farthest = Math.max(farthest, Math.hypot(point.x - spot.x, point.y - spot.y));
  }
  const shine = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, farthest);
  shine.addColorStop(0, "rgba(224, 242, 254, 1)");
  shine.addColorStop(0.28, "rgba(96, 165, 250, 1)");
  shine.addColorStop(1, "rgba(37, 99, 235, 0.72)");

  ctx.save();
  ctx.lineJoin = "round";
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = shine;
  trace(ctx, polygon);
  ctx.stroke();
  ctx.restore();
}
