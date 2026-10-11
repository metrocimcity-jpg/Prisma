import { describe, expect, it } from "vitest";
import { scrollAfterZoom, zoomFromWheel } from "@/ui/layout/pdfZoom";

describe("zoomFromWheel", () => {
  it("zooms in when the wheel moves up", () => {
    expect(zoomFromWheel(1, -100)).toBeGreaterThan(1);
  });

  it("zooms out when the wheel moves down", () => {
    expect(zoomFromWheel(1, 100)).toBeLessThan(1);
  });

  it("stays inside the zoom limits", () => {
    expect(zoomFromWheel(1, -100_000)).toBe(8);
    expect(zoomFromWheel(1, 100_000)).toBe(0.25);
  });
});

describe("scrollAfterZoom", () => {
  it("keeps the point under the pointer in place", () => {
    const previous = 1;
    const next = 2;
    const scroll = 40;
    const pointer = 80;
    const contentPoint = scroll + pointer;
    const nextScroll = scrollAfterZoom(scroll, pointer, previous, next);
    expect(nextScroll + pointer).toBeCloseTo(contentPoint * (next / previous));
  });
});
