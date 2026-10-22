export interface HandPoint {
  x: number;
  y: number;
}

export interface HandFrame {
  /** 21 MediaPipe hand landmarks in normalized camera coordinates. */
  landmarks: HandPoint[];
  gesture: string;
  score: number;
}

export type GestureCommand =
  | { type: "move"; x: number; y: number }
  | { type: "leave" }
  | { type: "tap"; x: number; y: number }
  | { type: "doubleTap"; x: number; y: number }
  | { type: "dragStart"; x: number; y: number }
  | { type: "drag"; x: number; y: number }
  | { type: "dragEnd"; x: number; y: number }
  | { type: "zoom"; x: number; y: number; delta: number }
  | { type: "back" }
  | { type: "reset" }
  | { type: "open" };

export interface GestureReadout {
  /** Human label of what the hand is doing right now. */
  label: string;
  /** 0..1 fill of a hold gesture before it fires. */
  progress: number;
  pinching: boolean;
  cursor: HandPoint | null;
}

export interface GestureStep {
  commands: GestureCommand[];
  readout: GestureReadout;
}

const WRIST = 0;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_TIP = 12;
const RING_TIP = 16;
const PINKY_TIP = 20;

const PINCH_ENTER = 0.45;
const PINCH_EXIT = 0.62;
const DOUBLE_TAP_MS = 450;
/** A second pinch edge this soon is camera noise, not another tap. */
const TAP_GAP_MS = 140;
const CAMERA_MARGIN = 0.16;
const MIN_SCORE = 0.6;
const ZOOM_DELAY_MS = 250;
const ZOOM_INTERVAL_MS = 90;
const ZOOM_DELTA = 1.6;
const HAND_LOST_MS = 250;
/** Keep a held pose through a short recognition dropout. */
const POSE_GRACE_MS = 200;

interface HoldGesture {
  label: string;
  holdMs: number;
  command: GestureCommand["type"];
}

const HOLD_GESTURES: Record<string, HoldGesture> = {
  Open_Palm: { label: "Open palm · back", holdMs: 550, command: "back" },
  Closed_Fist: { label: "Fist · reset view", holdMs: 850, command: "reset" },
  Victory: { label: "Victory · open file", holdMs: 400, command: "open" },
};

const ZOOM_GESTURES: Record<string, { label: string; sign: 1 | -1 }> = {
  Thumb_Up: { label: "Thumb up · zoom in", sign: 1 },
  Thumb_Down: { label: "Thumb down · zoom out", sign: -1 },
};

function distance(a: HandPoint, b: HandPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Mirror the selfie camera and stretch its comfortable middle region to the full view. */
export function cameraToView(point: HandPoint): HandPoint {
  const span = 1 - CAMERA_MARGIN * 2;
  return {
    x: clamp01((1 - point.x - CAMERA_MARGIN) / span),
    y: clamp01((point.y - CAMERA_MARGIN) / span),
  };
}

function reachFromWrist(landmarks: HandPoint[], index: number): number {
  return distance(landmarks[index]!, landmarks[WRIST]!);
}

/** Index and middle are the long fingers. Works when the classifier misses Victory. */
export function isVictoryPose(landmarks: HandPoint[]): boolean {
  if (landmarks.length <= PINKY_TIP) {
    return false;
  }
  const index = reachFromWrist(landmarks, INDEX_TIP);
  const middle = reachFromWrist(landmarks, MIDDLE_TIP);
  const ring = reachFromWrist(landmarks, RING_TIP);
  const pinky = reachFromWrist(landmarks, PINKY_TIP);
  const raised = Math.max(index, middle);
  if (raised <= 0) {
    return false;
  }
  return index > raised * 0.72 && middle > raised * 0.72 && ring < raised * 0.62 && pinky < raised * 0.62;
}

export function pinchRatio(landmarks: HandPoint[]): number {
  const size = distance(landmarks[WRIST], landmarks[MIDDLE_MCP]);
  if (size <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return distance(landmarks[THUMB_TIP], landmarks[INDEX_TIP]) / size;
}

/**
 * Turns per-frame hand observations into FoamTree-style navigation commands.
 * A pinch selects on release. Held poses fire once (back, reset, open)
 * or repeat while held (zoom).
 */
export class GestureInterpreter {
  private cursor: HandPoint | null = null;
  private pinching = false;
  private lastTapAt = Number.NEGATIVE_INFINITY;
  private pose = "None";
  private poseSince = 0;
  private poseFired = false;
  private poseGapStart = 0;
  private lastZoomAt = 0;
  private lastSeen = Number.NEGATIVE_INFINITY;

  step(hand: HandFrame | null, now: number): GestureStep {
    const commands: GestureCommand[] = [];
    if (!hand || hand.landmarks.length <= INDEX_TIP) {
      return this.lost(now, commands);
    }
    this.lastSeen = now;

    const recognized = hand.score >= MIN_SCORE ? hand.gesture : "None";
    const wasPinching = this.pinching;
    const ratio = pinchRatio(hand.landmarks);
    const indexOut = reachFromWrist(hand.landmarks, INDEX_TIP) > reachFromWrist(hand.landmarks, INDEX_MCP) * 0.8;
    const shapePinch = indexOut && (wasPinching ? ratio < PINCH_EXIT : ratio < PINCH_ENTER);
    const pose = shapePinch
      ? this.forcePose("None", now)
      : this.holdPose(isVictoryPose(hand.landmarks) || recognized === "Victory" ? "Victory" : recognized, now);
    this.pinching = shapePinch;

    const grip = this.pinching
      ? {
          x: (hand.landmarks[THUMB_TIP].x + hand.landmarks[INDEX_TIP].x) / 2,
          y: (hand.landmarks[THUMB_TIP].y + hand.landmarks[INDEX_TIP].y) / 2,
        }
      : {
          x: (hand.landmarks[INDEX_TIP].x * 2 + hand.landmarks[INDEX_MCP].x) / 3,
          y: (hand.landmarks[INDEX_TIP].y * 2 + hand.landmarks[INDEX_MCP].y) / 3,
        };
    this.cursor = this.smooth(cameraToView(grip));
    commands.push({ type: "move", ...this.cursor });
    const at = this.cursor;

    if (wasPinching && !this.pinching && now - this.lastTapAt >= TAP_GAP_MS) {
      commands.push({ type: "tap", ...at });
      if (now - this.lastTapAt <= DOUBLE_TAP_MS) {
        commands.push({ type: "doubleTap", ...at });
        this.lastTapAt = Number.NEGATIVE_INFINITY;
      } else {
        this.lastTapAt = now;
      }
    }

    if (this.pinching) {
      return {
        commands,
        readout: { label: "Pinch", progress: 0, pinching: true, cursor: at },
      };
    }

    const held = now - this.poseSince;

    const zoom = ZOOM_GESTURES[pose];
    if (zoom) {
      if (held >= ZOOM_DELAY_MS && now - this.lastZoomAt >= ZOOM_INTERVAL_MS) {
        this.lastZoomAt = now;
        commands.push({ type: "zoom", ...at, delta: zoom.sign * ZOOM_DELTA });
      }
      return {
        commands,
        readout: { label: zoom.label, progress: clamp01(held / ZOOM_DELAY_MS), pinching: false, cursor: at },
      };
    }

    const hold = HOLD_GESTURES[pose];
    if (hold) {
      if (!this.poseFired && held >= hold.holdMs) {
        this.poseFired = true;
        commands.push({ type: hold.command } as GestureCommand);
      }
      return {
        commands,
        readout: { label: hold.label, progress: clamp01(held / hold.holdMs), pinching: false, cursor: at },
      };
    }

    return {
      commands,
      readout: { label: pose === "Pointing_Up" ? "Pointing" : "Hand", progress: 0, pinching: false, cursor: at },
    };
  }

  reset(): void {
    this.cursor = null;
    this.pinching = false;
    this.lastTapAt = Number.NEGATIVE_INFINITY;
    this.poseGapStart = 0;
    this.resetPose("None", 0);
    this.lastSeen = Number.NEGATIVE_INFINITY;
  }

  private lost(now: number, commands: GestureCommand[]): GestureStep {
    const readout: GestureReadout = { label: "No hand", progress: 0, pinching: false, cursor: null };
    if (this.cursor === null || now - this.lastSeen < HAND_LOST_MS) {
      return { commands, readout: { ...readout, cursor: this.cursor } };
    }
    commands.push({ type: "leave" });
    this.reset();
    return { commands, readout };
  }

  /** Drop a held pose immediately so a pinch is not swallowed by a fist label. */
  private forcePose(next: string, now: number): string {
    this.poseGapStart = 0;
    if (this.pose !== next) {
      this.resetPose(next, now);
    }
    return next;
  }

  /** Keep the current hold through a brief "None" so the timer can finish. */
  private holdPose(next: string, now: number): string {
    if (next === this.pose) {
      this.poseGapStart = 0;
      return next;
    }
    if (next === "None" && this.pose !== "None") {
      if (this.poseGapStart === 0) {
        this.poseGapStart = now;
      }
      if (now - this.poseGapStart < POSE_GRACE_MS) {
        return this.pose;
      }
    }
    this.poseGapStart = 0;
    this.resetPose(next, now);
    return next;
  }

  private resetPose(pose: string, now: number): void {
    this.pose = pose;
    this.poseSince = now;
    this.poseFired = false;
    this.lastZoomAt = 0;
  }

  private smooth(next: HandPoint): HandPoint {
    const previous = this.cursor;
    if (!previous) {
      return next;
    }
    const speed = distance(previous, next);
    const alpha = Math.min(1, 0.22 + speed * 6);
    return {
      x: previous.x + (next.x - previous.x) * alpha,
      y: previous.y + (next.y - previous.y) * alpha,
    };
  }
}
