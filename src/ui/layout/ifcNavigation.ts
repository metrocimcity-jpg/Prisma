export const IFC_VIEWS = ["top", "bottom", "front", "back", "left", "right"] as const;

export type IfcStandardView = (typeof IFC_VIEWS)[number];

export const IFC_VIEW_LABELS: Record<IfcStandardView, string> = {
  top: "Top",
  bottom: "Bottom",
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
};

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** World-space face normals for the view cube. +Y is up, -Z is project north. */
export const IFC_FACE_NORMALS: Record<IfcStandardView, Vec3> = {
  top: { x: 0, y: 1, z: 0 },
  bottom: { x: 0, y: -1, z: 0 },
  front: { x: 0, y: 0, z: 1 },
  back: { x: 0, y: 0, z: -1 },
  right: { x: 1, y: 0, z: 0 },
  left: { x: -1, y: 0, z: 0 },
};

const TOP_TILT = 0.02;

function normalize(value: Vec3): Vec3 {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Direction from the model center to the camera. Top and bottom stay just off the pole so orbit can leave them. */
export function viewOffset(view: IfcStandardView): Vec3 {
  switch (view) {
    case "top":
      return { x: 0, y: Math.cos(TOP_TILT), z: Math.sin(TOP_TILT) };
    case "bottom":
      return { x: 0, y: -Math.cos(TOP_TILT), z: Math.sin(TOP_TILT) };
    case "front":
      return { x: 0, y: 0, z: 1 };
    case "back":
      return { x: 0, y: 0, z: -1 };
    case "right":
      return { x: 1, y: 0, z: 0 };
    case "left":
      return { x: -1, y: 0, z: 0 };
  }
}

/** Screen-up direction when the camera sits along `offset` with world up = +Y. */
export function screenUp(offset: Vec3): Vec3 {
  const look = normalize({ x: -offset.x, y: -offset.y, z: -offset.z });
  const worldUp = { x: 0, y: 1, z: 0 };
  const right = normalize(cross(look, worldUp));
  return normalize(cross(right, look));
}

export function fitDistance(offset: Vec3, size: Vec3, aspect: number, fovDeg: number): number {
  const look = normalize({ x: -offset.x, y: -offset.y, z: -offset.z });
  const up = screenUp(offset);
  const right = normalize(cross(look, up));
  const half = {
    x: Math.max(size.x, 1) / 2,
    y: Math.max(size.y, 1) / 2,
    z: Math.max(size.z, 1) / 2,
  };
  const extentRight = half.x * Math.abs(right.x) + half.y * Math.abs(right.y) + half.z * Math.abs(right.z);
  const extentUp = half.x * Math.abs(up.x) + half.y * Math.abs(up.y) + half.z * Math.abs(up.z);
  const halfY = ((fovDeg * Math.PI) / 180) / 2;
  const halfX = Math.atan(Math.tan(halfY) * Math.max(aspect, 0.25));
  return Math.max(extentUp / Math.tan(halfY), extentRight / Math.tan(halfX), 1) * 1.28;
}

export function frameView(
  view: IfcStandardView,
  size: Vec3,
  aspect: number,
  fovDeg: number,
): { position: Vec3; distance: number } {
  const offset = viewOffset(view);
  const direction = normalize(offset);
  const distance = fitDistance(offset, size, aspect, fovDeg);
  return {
    position: { x: direction.x * distance, y: direction.y * distance, z: direction.z * distance },
    distance,
  };
}

export function nearestIfcView(offset: Vec3): IfcStandardView {
  const direction = normalize(offset);
  let best: IfcStandardView = "top";
  let bestDot = -Infinity;
  for (const view of IFC_VIEWS) {
    const score = dot(direction, normalize(viewOffset(view)));
    if (score > bestDot) {
      best = view;
      bestDot = score;
    }
  }
  return best;
}

export function easeInOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped < 0.5 ? 2 * clamped * clamped : 1 - ((-2 * clamped + 2) ** 2) / 2;
}
