import { describe, expect, it } from "vitest";
import { applyHoverColor, boldenColor, drawHoveredCell, hoverGrowsCell } from "./hover";

function hueOf(color: string): number {
  const match = color.match(/hsla?\(\s*([\d.]+)/);
  return match ? Number(match[1]) : Number.NaN;
}

function saturationOf(color: string): number {
  const match = color.match(/hsla?\(\s*[\d.]+\s*,\s*([\d.]+)%/);
  return match ? Number(match[1]) : Number.NaN;
}

describe("hover color", () => {
  it("keeps the hue and makes a chromatic color stronger", () => {
    const bold = boldenColor("#5eb3ff");
    expect(Math.abs(hueOf(bold) - hueOf(boldenColor("hsl(208, 100%, 68%)")))).toBeLessThan(8);
    expect(hueOf(bold)).toBeGreaterThan(190);
    expect(hueOf(bold)).toBeLessThan(230);
    expect(saturationOf(bold)).toBe(100);
    expect(bold).toContain("61%");
  });

  it("deepens a neutral gray without adding a hue", () => {
    const bold = boldenColor("#8a8a8a");
    expect(saturationOf(bold)).toBe(0);
    expect(bold).toContain("44%");
  });

  it("stores the bolder color only while the cell is hovered", () => {
    const group = {};
    const variables = { groupColor: "#5eb3ff", labelColor: "auto" };
    applyHoverColor({ hovered: false, group }, variables);
    expect(variables.groupColor).toBe("#5eb3ff");
    applyHoverColor({ hovered: true, group }, variables);
    expect(variables.groupColor).not.toBe("#5eb3ff");
    expect(variables.labelColor).toBe("auto");
  });
});

describe("hover growth", () => {
  it("grows a leaf and a flattened folder, and leaves nested parents alone", () => {
    expect(hoverGrowsCell("hierarchical", { groups: [] }, { hovered: true })).toBe(true);
    expect(hoverGrowsCell("hierarchical", { groups: [{}] }, { hovered: true })).toBe(false);
    expect(hoverGrowsCell("flattened", { groups: [{}] }, { hovered: true })).toBe(true);
    expect(hoverGrowsCell("hierarchical", {}, { hovered: true, open: true })).toBe(false);
  });

  it("draws the same outline slightly larger from the cell center", () => {
    const group = {};
    applyHoverColor({ hovered: true, group }, { groupColor: "#ffb454", labelColor: "auto" });
    const calls: string[] = [];
    drawHoveredCell("hierarchical", {
      hovered: true,
      polygonCenterX: 10,
      polygonCenterY: 20,
      group,
      polygonContext: {
        replay: () => {
          calls.push("replay");
        },
      },
      context: {
        save: () => calls.push("save"),
        restore: () => calls.push("restore"),
        translate: (x, y) => calls.push(`translate:${x},${y}`),
        scale: (x, y) => calls.push(`scale:${x},${y}`),
        beginPath: () => calls.push("begin"),
        closePath: () => calls.push("close"),
        fill: () => calls.push("fill"),
        fillStyle: "",
      },
    });
    expect(calls).toContain("scale:1.08,1.08");
    expect(calls).toContain("replay");
    expect(calls.at(-1)).toBe("restore");
  });
});
