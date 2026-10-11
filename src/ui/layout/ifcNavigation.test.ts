import { describe, expect, it } from "vitest";
import { fitDistance, frameView, nearestIfcView, screenUp, viewOffset } from "@/ui/layout/ifcNavigation";

const size = { x: 80, y: 12, z: 40 };

describe("viewOffset", () => {
  it("puts the top view above the model, just off the vertical pole", () => {
    const top = viewOffset("top");
    expect(top.y).toBeGreaterThan(0.9);
    expect(top.y).toBeGreaterThan(Math.abs(top.z));
    expect(top.x).toBe(0);
  });

  it("keeps project north at the top of a top view", () => {
    const up = screenUp(viewOffset("top"));
    expect(up.z).toBeLessThan(-0.9);
  });

  it("keeps the roof at the top of a front view", () => {
    const up = screenUp(viewOffset("front"));
    expect(up.y).toBeGreaterThan(0.9);
  });
});

describe("frameView", () => {
  it("fits a larger plan farther away", () => {
    const near = fitDistance(viewOffset("top"), size, 1, 45);
    const far = fitDistance(viewOffset("top"), { x: 200, y: 12, z: 40 }, 1, 45);
    expect(far).toBeGreaterThan(near);
  });

  it("places the top camera on that view direction", () => {
    const frame = frameView("top", size, 1, 45);
    expect(frame.position.y).toBeGreaterThan(Math.abs(frame.position.x));
    expect(frame.position.y).toBeGreaterThan(Math.abs(frame.position.z));
  });
});

describe("nearestIfcView", () => {
  it("names the axis the camera is sitting on", () => {
    expect(nearestIfcView({ x: 0, y: 10, z: 0.2 })).toBe("top");
    expect(nearestIfcView({ x: 8, y: 0, z: 0 })).toBe("right");
    expect(nearestIfcView({ x: 0, y: 1, z: 6 })).toBe("front");
  });
});
