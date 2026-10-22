import { describe, expect, it, vi } from "vitest";
import { applyFoamGesture, setGestureTarget } from "@/gestures/applyFoamGesture";
import type { FoamTree, FoamTreeGroup } from "@carrotsearch/foamtree";

function stage() {
  return { clientWidth: 800, clientHeight: 600 };
}

function foam() {
  return {
    trigger: vi.fn(),
    redraw: vi.fn(),
    get: vi.fn(() => []),
    select: vi.fn(async () => undefined),
    expose: vi.fn(async () => undefined),
    reset: vi.fn(async () => undefined),
  } as unknown as FoamTree & { trigger: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
}

describe("applyFoamGesture", () => {
  it("zooms in through FoamTree mousewheel, not a DOM event", () => {
    const api = foam();
    applyFoamGesture({ type: "zoom", x: 0.25, y: 0.5, delta: 1.6 }, stage(), api);
    expect(api.trigger).toHaveBeenCalledWith("mousewheel", {
      x: 200,
      y: 300,
      delta: 0.5,
    });
  });

  it("selects the cell under the cursor without FoamTree's click zoom", () => {
    const api = foam();
    const group: FoamTreeGroup = { id: "bim", label: "BIM", groups: [{ id: "child" }] };
    setGestureTarget(group);
    applyFoamGesture({ type: "tap", x: 0.5, y: 0.5 }, stage(), api);
    expect(api.trigger).toHaveBeenCalledWith("hover", { x: 400, y: 300 });
    expect(api.select).toHaveBeenCalledWith(group);
    expect(api.expose).not.toHaveBeenCalled();
  });

  it("drills into a group on double pinch and does not expose a file", () => {
    const api = foam();
    const file: FoamTreeGroup = { id: "file", isFile: true };
    setGestureTarget(file);
    applyFoamGesture({ type: "doubleTap", x: 0.5, y: 0.5 }, stage(), api);
    expect(api.expose).not.toHaveBeenCalled();
    expect(api.select).toHaveBeenCalledWith(file);

    const folder: FoamTreeGroup = { id: "bim", groups: [{ id: "arch" }] };
    setGestureTarget(folder);
    applyFoamGesture({ type: "doubleTap", x: 0.5, y: 0.5 }, stage(), api);
    expect(api.expose).toHaveBeenCalledWith(folder);
  });

  it("goes back by closing the exposed group", () => {
    const api = foam();
    const child = { id: "child" };
    api.get.mockReturnValue([{ id: "root" }, child]);
    applyFoamGesture({ type: "back" }, stage(), api);
    expect(api.expose).toHaveBeenCalledWith([{ id: "root" }]);
  });
});
