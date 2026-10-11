import { scrollAfterZoom, zoomFromWheel } from "@/ui/layout/pdfZoom";
import { getDocument, GlobalWorkerOptions, type PDFPageProxy, type RenderTask } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfStageProps {
  src: string;
  title: string;
}

export function PdfStage({ src, title }: PdfStageProps): JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const zoomModeRef = useRef(false);
  const pendingScroll = useRef<{ left: number; top: number } | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [fitWidth, setFitWidth] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [zoomMode, setZoomMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    zoomModeRef.current = zoomMode;
  }, [zoomMode]);

  useEffect(() => {
    let cancelled = false;
    setPages([]);
    setError(null);
    setZoom(1);
    zoomRef.current = 1;
    setZoomMode(false);
    zoomModeRef.current = false;
    const task = getDocument({ url: src });
    void task.promise
      .then(async (doc) => {
        if (cancelled) {
          return;
        }
        const loaded: PDFPageProxy[] = [];
        for (let number = 1; number <= doc.numPages; number += 1) {
          loaded.push(await doc.getPage(number));
          if (cancelled) {
            return;
          }
        }
        setPages(loaded);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not open this PDF");
        }
      });
    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [src]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const first = pages[0];
    if (!scroller || !first) {
      return;
    }
    const measure = (): void => {
      const style = getComputedStyle(scroller);
      const pad = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
      const available = Math.max(1, scroller.clientWidth - pad);
      const width = first.getViewport({ scale: 1 }).width;
      setFitWidth(available / width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [pages]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const onWheel = (event: WheelEvent): void => {
      if (!zoomModeRef.current) {
        return;
      }
      event.preventDefault();
      const previous = zoomRef.current;
      const next = zoomFromWheel(previous, event.deltaY);
      if (next === previous) {
        return;
      }
      const rect = scroller.getBoundingClientRect();
      pendingScroll.current = {
        left: scrollAfterZoom(scroller.scrollLeft, event.clientX - rect.left, previous, next),
        top: scrollAfterZoom(scroller.scrollTop, event.clientY - rect.top, previous, next),
      };
      zoomRef.current = next;
      setZoom(next);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [pages.length]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const pending = pendingScroll.current;
    if (!scroller || !pending) {
      return;
    }
    scroller.scrollLeft = pending.left;
    scroller.scrollTop = pending.top;
    pendingScroll.current = null;
  }, [zoom]);

  const scale = fitWidth * zoom;

  return (
    <div className={zoomMode ? "pdf-stage is-zooming" : "pdf-stage"}>
      <div
        className="pdf-scroll"
        ref={scrollerRef}
        onContextMenu={(event) => {
          event.preventDefault();
          setZoomMode((current) => {
            zoomModeRef.current = !current;
            return !current;
          });
        }}
      >
        {error ? <p className="pdf-status">{error}</p> : null}
        {!error && pages.length === 0 ? <p className="pdf-status">Opening PDF…</p> : null}
        <div className="pdf-pages">
          {pages.map((page) => (
            <PdfPage key={page.pageNumber} page={page} scale={scale} rootRef={scrollerRef} />
          ))}
        </div>
      </div>
      <div className="pdf-hint">
        <span>
          {zoomMode ? "Scroll to zoom. Right-click again to scroll the pages." : "Right-click the page, then scroll to zoom."}
        </span>
        <span>{Math.round(zoom * 100)}%</span>
      </div>
      <span className="pdf-sr">{title}</span>
    </div>
  );
}

function PdfPage({
  page,
  scale,
  rootRef,
}: {
  page: PDFPageProxy;
  scale: number;
  rootRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const base = page.getViewport({ scale: 1 });
  const cssWidth = base.width * scale;
  const cssHeight = base.height * scale;

  useEffect(() => {
    const host = hostRef.current;
    const root = rootRef.current;
    if (!host || !root) {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry?.isIntersecting ?? false);
      },
      { root, rootMargin: "600px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [rootRef, page]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!visible || !canvas || scale <= 0) {
      return;
    }
    let cancelled = false;
    let task: RenderTask | null = null;
    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * pixelRatio });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    task = page.render({ canvas, viewport });
    void task.promise.catch((renderError: unknown) => {
      if (cancelled) {
        return;
      }
      const name = renderError instanceof Error ? renderError.name : "";
      if (name === "RenderingCancelledException") {
        return;
      }
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, page, scale]);

  return (
    <div className="pdf-page" ref={hostRef} style={{ width: cssWidth, height: cssHeight }}>
      <canvas ref={canvasRef} aria-label={`Page ${page.pageNumber}`} />
    </div>
  );
}
