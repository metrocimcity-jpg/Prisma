import { describe, expect, it } from "vitest";
import { GestureInterpreter, cameraToView, isVictoryPose, type GestureCommand, type HandFrame, type HandPoint } from "@/gestures/gestureLogic";

function hand({ x = 0.5, y = 0.5, pinch = false, gesture = "None", score = 0.9 } = {}): HandFrame {
  const landmarks = Array.from({ length: 21 }, () => ({ x, y }));
  landmarks[0] = { x, y: y + 0.2 };
  landmarks[9] = { x, y };
  landmarks[5] = { x, y: y - 0.02 };
  landmarks[8] = { x, y: y - 0.05 };
  landmarks[4] = pinch ? { x: x + 0.01, y: y - 0.05 } : { x: x + 0.15, y };
  return { landmarks, gesture, score };
}

function types(commands: GestureCommand[]): string[] {
  return commands.map((command) => command.type).filter((type) => type !== "move" && type !== "drag");
}

describe("cameraToView", () => {
  it("mirrors the selfie camera and stretches the middle region", () => {
    const corner = cameraToView({ x: 0.84, y: 0.16 });
    expect(corner.x).toBeCloseTo(0);
    expect(corner.y).toBeCloseTo(0);
    expect(cameraToView({ x: 0.5, y: 0.5 }).x).toBeCloseTo(0.5);
    expect(cameraToView({ x: 0, y: 1 })).toEqual({ x: 1, y: 1 });
  });
});

describe("GestureInterpreter", () => {
  it("turns a quick pinch into a tap and two quick pinches into a double tap", () => {
    const gi = new GestureInterpreter();
    gi.step(hand(), 0);
    gi.step(hand({ pinch: true }), 30);
    expect(types(gi.step(hand(), 150).commands)).toEqual(["tap"]);
    gi.step(hand({ pinch: true }), 250);
    expect(types(gi.step(hand(), 350).commands)).toEqual(["tap", "doubleTap"]);
  });

  it("ignores a second pinch edge that is just camera noise", () => {
    const gi = new GestureInterpreter();
    const seen: string[] = [];
    gi.step(hand(), 0);
    gi.step(hand({ pinch: true }), 20);
    seen.push(...types(gi.step(hand(), 80).commands));
    gi.step(hand({ pinch: true }), 100);
    seen.push(...types(gi.step(hand(), 140).commands));
    expect(seen).toEqual(["tap"]);
  });

  it("selects a pinch even when the classifier calls it a fist", () => {
    const gi = new GestureInterpreter();
    gi.step(hand({ gesture: "Closed_Fist" }), 0);
    gi.step(hand({ pinch: true, gesture: "Closed_Fist" }), 40);
    expect(types(gi.step(hand({ gesture: "Closed_Fist" }), 180).commands)).toEqual(["tap"]);
  });

  it("selects when the hand moves during a pinch", () => {
    const gi = new GestureInterpreter();
    gi.step(hand(), 0);
    gi.step(hand({ pinch: true }), 30);
    for (let i = 1; i <= 10; i += 1) {
      gi.step(hand({ pinch: true, x: 0.5 - i * 0.02 }), 30 + i * 30);
    }
    expect(types(gi.step(hand({ x: 0.3 }), 400).commands)).toEqual(["tap"]);
  });

  it("fires back once after holding an open palm", () => {
    const gi = new GestureInterpreter();
    const fired: string[] = [];
    for (let t = 0; t <= 1500; t += 50) {
      fired.push(...types(gi.step(hand({ gesture: "Open_Palm" }), t).commands));
    }
    expect(fired).toEqual(["back"]);
  });

  it("repeats zoom while a thumb is held and ignores low-confidence poses", () => {
    const gi = new GestureInterpreter();
    const zooms: number[] = [];
    for (let t = 0; t <= 1000; t += 30) {
      for (const command of gi.step(hand({ gesture: "Thumb_Up" }), t).commands) {
        if (command.type === "zoom") {
          zooms.push(command.delta);
        }
      }
    }
    expect(zooms.length).toBeGreaterThan(4);
    expect(zooms.every((delta) => delta > 0)).toBe(true);

    const weak = new GestureInterpreter();
    const none: string[] = [];
    for (let t = 0; t <= 1500; t += 50) {
      none.push(...types(weak.step(hand({ gesture: "Closed_Fist", score: 0.3 }), t).commands));
    }
    expect(none).toEqual([]);
  });

  it("leaves once the hand is gone", () => {
    const gi = new GestureInterpreter();
    gi.step(hand(), 0);
    gi.step(hand({ pinch: true }), 30);
    gi.step(hand({ pinch: true, x: 0.3 }), 60);
    expect(types(gi.step(null, 100).commands)).toEqual([]);
    expect(types(gi.step(null, 400).commands)).toEqual(["leave"]);
  });

  it("opens a file from a two-finger pose when the classifier misses it", () => {
    const landmarks = victoryHand();
    expect(isVictoryPose(landmarks)).toBe(true);
    const gi = new GestureInterpreter();
    const fired: string[] = [];
    for (let t = 0; t <= 800; t += 50) {
      fired.push(...types(gi.step({ landmarks, gesture: "None", score: 0.1 }, t).commands));
    }
    expect(fired).toEqual(["open"]);
  });
});

function victoryHand(): HandPoint[] {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.6 }));
  landmarks[0] = { x: 0.5, y: 0.9 };
  landmarks[4] = { x: 0.28, y: 0.62 };
  landmarks[5] = { x: 0.42, y: 0.55 };
  landmarks[6] = { x: 0.42, y: 0.4 };
  landmarks[8] = { x: 0.42, y: 0.18 };
  landmarks[9] = { x: 0.5, y: 0.52 };
  landmarks[10] = { x: 0.5, y: 0.34 };
  landmarks[12] = { x: 0.5, y: 0.12 };
  landmarks[13] = { x: 0.58, y: 0.56 };
  landmarks[14] = { x: 0.58, y: 0.46 };
  landmarks[16] = { x: 0.58, y: 0.54 };
  landmarks[17] = { x: 0.66, y: 0.58 };
  landmarks[18] = { x: 0.66, y: 0.5 };
  landmarks[20] = { x: 0.66, y: 0.56 };
  return landmarks;
}
