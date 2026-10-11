const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

/** Wheel delta to a zoom multiplier. Scroll up zooms in. */
export function zoomFromWheel(current: number, deltaY: number): number {
  const next = current * Math.exp(-deltaY * 0.0015);
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
}

/** Keep the point under the pointer fixed while the page scale changes. */
export function scrollAfterZoom(scroll: number, pointer: number, previousZoom: number, nextZoom: number): number {
  if (previousZoom === 0) {
    return scroll;
  }
  return (scroll + pointer) * (nextZoom / previousZoom) - pointer;
}
