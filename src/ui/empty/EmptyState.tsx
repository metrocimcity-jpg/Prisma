import { useLayoutEffect, useRef } from "react";
import { actions } from "@/state/store";

/** Dot grid tiles are 6vmin / √2, with each dot centered in its tile. */
const DOT_CELL = 0.06 / Math.SQRT2;

export function EmptyState(): JSX.Element {
  const frameRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const stage = frame?.parentElement;
    if (!frame || !stage) {
      return;
    }

    const place = (): void => {
      const stageRect = stage.getBoundingClientRect();
      const pattern = document.querySelector(".app-backdrop-pattern");
      const patternRect = pattern?.getBoundingClientRect();
      const patternCell = pattern ? Number.parseFloat(getComputedStyle(pattern).backgroundSize) : Number.NaN;
      const cell = Number.isFinite(patternCell) && patternCell > 0
        ? patternCell
        : Math.min(window.innerWidth, window.innerHeight) * DOT_CELL;
      const originX = patternRect?.left ?? 0;
      const originY = patternRect?.top ?? 0;
      const phase = cell / 2;
      const snap = (value: number, origin: number): number => origin + Math.round((value - origin - phase) / cell) * cell + phase;
      const ceilSnap = (value: number, origin: number): number => origin + Math.ceil((value - origin - phase) / cell - 1e-6) * cell + phase;
      const floorSnap = (value: number, origin: number): number => origin + Math.floor((value - origin - phase) / cell + 1e-6) * cell + phase;

      frame.style.setProperty("--cell", `${cell}px`);
      frame.style.width = "max-content";
      frame.style.height = "max-content";

      const buttons = [...frame.querySelectorAll("button")];
      buttons.forEach((button) => {
        button.style.width = "auto";
      });
      const widest = Math.ceil(Math.max(...buttons.map((button) => button.getBoundingClientRect().width)));
      buttons.forEach((button) => {
        button.style.width = `${widest}px`;
      });

      const paragraph = frame.querySelector("p");
      const actions = frame.querySelector(".actions");
      if (paragraph && actions) {
        paragraph.style.maxWidth = `${actions.getBoundingClientRect().width}px`;
      }

      const box = frame.getBoundingClientRect();
      const pad = 1;
      const outerLeft = floorSnap(box.left - pad, originX);
      const outerRight = ceilSnap(box.right + pad, originX);
      const outerTop = floorSnap(box.top - pad, originY);
      const outerBottom = ceilSnap(box.bottom + pad, originY);
      let edgeLeft = outerLeft;
      let edgeRight = outerRight;
      let edgeTop = outerTop;
      let edgeBottom = outerBottom;
      if (outerRight - (outerLeft + cell) >= box.width && box.left - (outerLeft + cell) >= 8) {
        edgeLeft += cell;
      }
      if (outerRight - cell - outerLeft >= box.width && outerRight - cell - box.right >= 8) {
        edgeRight -= cell;
      }
      if (outerBottom - (outerTop + cell) >= box.height && box.top - (outerTop + cell) >= 8) {
        edgeTop += cell;
      }
      if (outerBottom - cell - outerTop >= box.height && outerBottom - cell - box.bottom >= 8) {
        edgeBottom -= cell;
      }
      const width = Math.max(cell, edgeRight - edgeLeft);
      const height = Math.max(cell, edgeBottom - edgeTop);
      const minLeft = ceilSnap(stageRect.left, originX);
      const maxLeft = floorSnap(stageRect.right - width, originX);
      const minTop = ceilSnap(stageRect.top, originY);
      const maxTop = floorSnap(stageRect.bottom - height, originY);
      let left = snap(stageRect.left + (stageRect.width - width) / 2, originX);
      let top = snap(stageRect.top + (stageRect.height - height) / 2, originY);
      if (maxLeft >= minLeft) {
        left = Math.min(Math.max(left, minLeft), maxLeft);
      }
      if (maxTop >= minTop) {
        top = Math.min(Math.max(top, minTop), maxTop);
      }

      frame.style.left = `${left}px`;
      frame.style.top = `${top}px`;
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
    };

    place();
    const observer = new ResizeObserver(place);
    observer.observe(stage);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, []);

  return (
    <div ref={frameRef} className="empty-state">
      <h2>No files loaded yet</h2>
      <p>
        Load a real folder from your computer, or explore a generated sample project to see how it works.
      </p>
      <div className="actions">
        <button className="primary" type="button" onClick={() => void actions.openFolder()}>
          Load folder
        </button>
        <button type="button" onClick={() => actions.loadSample()}>
          Try sample data
        </button>
      </div>
    </div>
  );
}
