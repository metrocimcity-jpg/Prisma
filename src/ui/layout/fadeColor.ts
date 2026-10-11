import * as d3 from "d3";

/** A muted, slightly gray version of a color. The hue stays visible. */
export function fadeTowardGray(value: string): string {
  const parsed = d3.color(value);
  if (!parsed) {
    return value;
  }
  return String(d3.interpolateRgb(parsed, "#9aa1b1")(0.42));
}
