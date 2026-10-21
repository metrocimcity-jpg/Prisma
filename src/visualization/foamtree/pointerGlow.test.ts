import { describe, expect, it } from "vitest";
import { fromCenter } from "./pointerGlow";

describe("pointer glow", () => {
  it("is strongest at the center and fades to the edge", () => {
    expect(fromCenter({ x: 0.5, y: 0.5 })).toBe(0);
    expect(fromCenter({ x: 0, y: 0.5 })).toBe(1);
    expect(fromCenter({ x: 0, y: 0 })).toBe(1);
    expect(fromCenter({ x: 0.75, y: 0.5 })).toBeCloseTo(0.5);
  });
});
