import { type GestureCommand } from "@/gestures/gestureLogic";
import { clearCellPointer, setCellPointer } from "@/visualization/foamtree/pointerGlow";
import { getFoamTreeInstance } from "@/visualization/foamtree/host";
import type { FoamTree, FoamTreeGroup } from "@carrotsearch/foamtree";

type StageBox = { clientWidth: number; clientHeight: number };

/** Group last reported under the cursor. A pinch selects this; it never uses FoamTree's click zoom. */
let target: FoamTreeGroup | null = null;

export function setGestureTarget(group: FoamTreeGroup | null): void {
  if (!group || group.attribution === true || group.description === true) {
    target = null;
    return;
  }
  target = group;
}

function localPoint(host: StageBox, x: number, y: number): { x: number; y: number } {
  return {
    x: x * host.clientWidth,
    y: y * host.clientHeight,
  };
}

function trigger(foam: FoamTree, type: string, point: { x: number; y: number }, extra: Record<string, unknown> = {}): void {
  foam.trigger(type, { ...point, ...extra });
}

async function appActions(): Promise<{
  actions: {
    hover: (id: string | null) => void;
    select: (id: string | null) => void;
    navigateBack: () => void;
    setFocusPath: (path: string[]) => void;
    openNode: (id: string | null) => Promise<void>;
  };
  getState: () => { selectedId: string | null };
}> {
  return import("@/state/store");
}

/**
 * FoamTree copies `delta` into the wheel handler and does `Math.pow(factor, delta)`.
 * An absent or non-finite delta is NaN, and a NaN scale clears the whole map.
 */
function zoomStep(delta: number): { delta: number } | null {
  if (!Number.isFinite(delta) || delta === 0) {
    return null;
  }
  return { delta: delta > 0 ? 0.5 : -0.5 };
}

function foamId(group: FoamTreeGroup): string | null {
  return typeof group.id === "string" && group.id.length > 0 ? group.id : null;
}

/** File index id when the cell is a file, otherwise the FoamTree group id. */
function selectionId(group: FoamTreeGroup): string | null {
  if (typeof group.sourceId === "string" && group.sourceId.length > 0) {
    return group.sourceId;
  }
  return foamId(group);
}

function isFolder(group: FoamTreeGroup): boolean {
  return group.isFile !== true && Array.isArray(group.groups) && group.groups.length > 0;
}

function aim(foam: FoamTree | null, host: StageBox, x: number, y: number): void {
  if (!foam) {
    return;
  }
  trigger(foam, "hover", localPoint(host, x, y));
}

function rememberSelection(group: FoamTreeGroup): void {
  const id = selectionId(group);
  if (!id || typeof document === "undefined") {
    return;
  }
  void appActions().then(({ actions }) => actions.select(id));
}

/**
 * Drive the original FoamTree stage from camera commands.
 * FoamTree listens on document and ignores synthetic clicks, so this uses `trigger`.
 */
export function applyFoamGesture(
  command: GestureCommand,
  host: StageBox | null,
  foam: FoamTree | null = getFoamTreeInstance(),
): void {
  if (!host || host.clientWidth <= 0 || host.clientHeight <= 0) {
    return;
  }

  switch (command.type) {
    case "move": {
      const point = localPoint(host, command.x, command.y);
      setCellPointer(point.x, point.y);
      if (foam) {
        trigger(foam, "hover", point);
        foam.redraw();
      }
      return;
    }
    case "leave":
      clearCellPointer();
      target = null;
      foam?.redraw();
      void appActions().then(({ actions }) => actions.hover(null));
      return;
    case "zoom": {
      const step = zoomStep(command.delta);
      if (!foam || !step) {
        return;
      }
      trigger(foam, "mousewheel", localPoint(host, command.x, command.y), step);
      return;
    }
    case "dragStart":
    case "drag":
    case "dragEnd":
      // FoamTree's drag ends in a fling that throws the map off the canvas.
      return;
    case "tap": {
      aim(foam, host, command.x, command.y);
      if (!foam || !target) {
        return;
      }
      void foam.select(target);
      rememberSelection(target);
      return;
    }
    case "doubleTap": {
      aim(foam, host, command.x, command.y);
      if (!foam || !target) {
        return;
      }
      if (isFolder(target)) {
        void foam.expose(target);
        return;
      }
      void foam.select(target);
      rememberSelection(target);
      return;
    }
    case "back": {
      if (!foam) {
        void appActions().then(({ actions }) => actions.navigateBack());
        return;
      }
      const exposure = foam.get("exposure");
      const exposed = Array.isArray(exposure) ? exposure : [];
      if (exposed.length > 0) {
        void foam.expose(exposed.slice(0, -1));
        return;
      }
      const step = zoomStep(-1);
      if (step) {
        trigger(foam, "mousewheel", localPoint(host, 0.5, 0.5), step);
      }
      return;
    }
    case "reset":
      void appActions().then(({ actions }) => actions.setFocusPath([]));
      void foam?.reset();
      return;
    case "open": {
      const group = target;
      if (foam && group && isFolder(group)) {
        void foam.expose(group);
        return;
      }
      if (foam && group) {
        void foam.select(group);
        rememberSelection(group);
      }
      const chosen = group ? selectionId(group) : null;
      if (typeof document === "undefined") {
        return;
      }
      void appActions().then(({ actions, getState }) => actions.openNode(chosen ?? getState().selectedId));
      return;
    }
    default:
      return;
  }
}
