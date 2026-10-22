import { getGestureVideo, stopGestures, useGestureState } from "@/gestures/gestureCamera";
import { useEffect, useRef, type RefObject } from "react";

const HAND_LINKS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];

const LEGEND: Array<[string, string]> = [
  ["☝", "Point to move"],
  ["🤏", "Pinch to select"],
  ["🤏🤏", "Double pinch to zoom in on a cell"],
  ["👍 / 👎", "Hold to zoom in / out"],
  ["✋", "Hold open palm to go back"],
  ["✊", "Hold fist to reset"],
  ["✌", "Hold victory to open file"],
];

export function GestureOverlay({ hostRef }: { hostRef: RefObject<HTMLDivElement | null> }): JSX.Element | null {
  const gesture = useGestureState();
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preview = previewRef.current;
    const video = getGestureVideo();
    if (!preview || !video || gesture.status !== "on") {
      return;
    }
    video.className = "gesture-video";
    preview.prepend(video);
    return () => {
      video.remove();
    };
  }, [gesture.status]);

  if (gesture.status === "off") {
    return null;
  }

  const rect = hostRef.current?.getBoundingClientRect();
  const cursor = gesture.readout.cursor;
  const progress = gesture.readout.progress;

  return (
    <>
      {rect && cursor && (
        <div
          className={gesture.readout.pinching ? "gesture-cursor is-pinching" : "gesture-cursor"}
          style={{
            left: rect.left + cursor.x * rect.width,
            top: rect.top + cursor.y * rect.height,
            ["--gesture-progress" as string]: `${Math.round(progress * 360)}deg`,
          }}
          aria-hidden
        />
      )}
      <aside className="gesture-panel" aria-label="Hand gesture navigation">
        <div className="gesture-preview" ref={previewRef}>
          {gesture.landmarks && (
            <svg className="gesture-skeleton" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden>
              {HAND_LINKS.map(([a, b]) => {
                const from = gesture.landmarks?.[a];
                const to = gesture.landmarks?.[b];
                return from && to ? <line key={`${a}-${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
              })}
            </svg>
          )}
          {gesture.message && <div className="gesture-preview-note">{gesture.message}</div>}
        </div>
        <div className="gesture-head">
          <span className={`gesture-dot is-${gesture.status}`} />
          <span className="gesture-label">
            {gesture.status === "on" ? gesture.message || gesture.readout.label : gesture.status === "loading" ? "Camera" : "Unavailable"}
          </span>
          <button type="button" className="gesture-close" title="Turn off hand gestures" onClick={stopGestures}>
            ×
          </button>
        </div>
        <ul className="gesture-legend">
          {LEGEND.map(([icon, text]) => (
            <li key={text}>
              <span className="gesture-icon">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
