import { actions, getState } from "@/state/store";
import { disciplineLegendLabel, growingSnapshot, growingTrail, type GrowingModel, type GrowingSnapshot } from "@/ui/layout/growing";
import { focusSidebarOverview } from "@/ui/layout/sidebarSearch";
import { previewKind } from "@/utils/previewKind";
import { DISK_ATLAS_PALETTE } from "@/visualization/palettes";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

const PLAY_MS = 24_000;

function formatStamp(date: number): string {
  const value = new Date(date);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function AnalysisGrowingChart({
  model,
  fileMode = false,
  selectedId = null,
  sizeScaleMb,
}: {
  model: GrowingModel;
  fileMode?: boolean;
  selectedId?: string | null;
  sizeScaleMb?: number;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(model.minDate);
  const [playing, setPlaying] = useState(false);
  const disciplines = useMemo(
    () => [...new Set(model.series.map((series) => series.discipline))].sort((left, right) => left.localeCompare(right)),
    [model.series],
  );
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const color = useMemo(
    () => d3.scaleOrdinal<string, string>(disciplines, [...d3.schemeTableau10, ...DISK_ATLAS_PALETTE]).unknown("#7a7f89"),
    [disciplines],
  );
  const disciplineKey = disciplines.join("\0");

  useEffect(() => {
    setHidden(new Set());
  }, [disciplineKey]);

  useEffect(() => {
    setTime(model.minDate);
    setPlaying(false);
  }, [model.minDate, model.maxDate]);

  useEffect(() => {
    if (!playing) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const tick = (now: number): void => {
      const elapsed = now - last;
      last = now;
      setTime((current) => {
        const next = current + ((model.maxDate - model.minDate) * elapsed) / PLAY_MS;
        if (next >= model.maxDate) {
          setPlaying(false);
          return model.maxDate;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, model.minDate, model.maxDate]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const draw = (): void => {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 280);
      const margin = { top: 28, right: 28, bottom: 42, left: 52 };
      const snapshots = growingSnapshot(model, time).filter((snapshot) => !hidden.has(snapshot.discipline));
      const trails = model.series
        .filter((series) => !hidden.has(series.discipline))
        .map((series) => growingTrail(series, time))
        .filter((trail) => trail !== null && trail.points.length > 0);
      const x = d3.scaleTime().domain([model.minDate, model.maxDate]).range([margin.left, width - margin.right]);
      const y = d3
        .scaleLinear()
        .domain([1, model.maxVersion])
        .nice()
        .range([height - margin.bottom, margin.top]);
      const radius = d3.scaleSqrt().domain([0, Math.max(model.maxSizeMb, sizeScaleMb ?? 0)]).range([5, 46]);

      host.replaceChildren();
      const svg = d3
        .select(host)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .attr("role", "img")
        .attr("aria-label", "Gapminder. Horizontal axis is date, vertical axis is version, circle size is file size.")
        .style("color", "var(--text)")
        .style("font-family", "var(--font-ui)")
        .style("font-size", "14.4px");

      svg
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(6).tickFormat((value) => formatStamp(Number(value))))
        .call((group) => group.select(".domain").attr("stroke", "rgba(255,255,255,0.35)"))
        .call((group) => group.selectAll("text").attr("fill", "currentColor"));
      svg
        .append("text")
        .attr("x", width / 2)
        .attr("y", height - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .text("Date");

      svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(6).tickFormat((value) => String(Math.round(Number(value)))))
        .call((group) => group.select(".domain").attr("stroke", "rgba(255,255,255,0.35)"))
        .call((group) => group.selectAll("text").attr("fill", "currentColor"));
      svg
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 16)
        .attr("text-anchor", "middle")
        .attr("fill", "currentColor")
        .text("Version");

      const footprints = trails.flatMap((trail) => {
        const kept: Array<(typeof trail.points)[number]> = [];
        for (const point of trail.points) {
          const last = kept.at(-1);
          const moved =
            !last ||
            Math.hypot(x(point.date) - x(last.date), y(point.version) - y(last.version)) >= 16 ||
            Math.abs(radius(point.sizeMb) - radius(last.sizeMb)) >= 4;
          if (moved) {
            kept.push(point);
          }
        }
        const newest = trail.points.at(-1);
        if (newest && kept.at(-1) !== newest) {
          kept.push(newest);
        }
        return kept.map((point) => ({ ...point, discipline: trail.discipline }));
      });
      svg
        .append("g")
        .attr("pointer-events", "none")
        .selectAll("circle")
        .data(footprints)
        .join("circle")
        .attr("cx", (point) => x(point.date))
        .attr("cy", (point) => y(point.version))
        .attr("r", (point) => radius(point.sizeMb))
        .attr("fill", (point) => color(point.discipline))
        .attr("fill-opacity", 0.16)
        .attr("stroke", "none");

      svg
        .append("line")
        .attr("x1", x(time))
        .attr("x2", x(time))
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom)
        .attr("stroke", "rgba(255,255,255,0.35)")
        .attr("stroke-dasharray", "4 4");

      svg
        .append("text")
        .attr("x", width - margin.right)
        .attr("y", margin.top + 28)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(255,255,255,0.28)")
        .style("font-size", "42px")
        .text(formatStamp(time));

      const marks = svg
        .append("g")
        .selectAll("g")
        .data(snapshots, (snapshot) => (snapshot as GrowingSnapshotMark).id)
        .join("g")
        .attr("transform", (snapshot) => `translate(${x(snapshot.date)},${y(snapshot.version)})`);
      const circles = marks
        .append("circle")
        .attr("r", (snapshot) => radius(snapshot.sizeMb))
        .attr("fill", (snapshot) => color(snapshot.discipline))
        .attr("fill-opacity", 0.82)
        .attr("stroke", (snapshot) => (fileMode && snapshot.id === selectedId ? "#f08a24" : "none"))
        .attr("stroke-width", (snapshot) => (fileMode && snapshot.id === selectedId ? 2.5 : 0));
      circles.append("title").text((snapshot) => {
        const discipline = disciplineLegendLabel(snapshot.discipline);
        const name = snapshot.label === snapshot.discipline ? discipline : `${snapshot.label}\n${discipline}`;
        const hint = fileMode ? "\nClick for overview, double-click to open" : "";
        return `${name}\nVersion ${snapshot.version.toFixed(1)}\n${Math.round(snapshot.sizeMb)} MB\n${formatStamp(snapshot.date)}${hint}`;
      });
      if (fileMode) {
        circles
          .style("cursor", "pointer")
          .attr("role", "button")
          .attr("tabindex", 0)
          .attr("aria-label", (snapshot) => snapshot.label)
          .on("click", (event: MouseEvent, snapshot: GrowingSnapshot) => {
            event.stopPropagation();
            showFileOverview(snapshot);
          })
          .on("dblclick", (event: MouseEvent, snapshot: GrowingSnapshot) => {
            event.stopPropagation();
            openFileFromCircle(snapshot);
          });
        marks.filter((snapshot) => snapshot.id === selectedId).raise();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [color, fileMode, hidden, model, selectedId, sizeScaleMb, time]);

  return (
    <div className="analysis-chart">
      <div className="analysis-plot growing-plot" ref={hostRef} />
      <div className="growing-controls">
        <button type="button" className="ghost" onClick={() => setPlaying((current) => !current)}>
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          min={model.minDate}
          max={model.maxDate}
          step={86_400_000}
          value={time}
          aria-label="Date"
          onChange={(event) => {
            setPlaying(false);
            setTime(Number(event.target.value));
          }}
        />
        <span className="growing-date">{formatStamp(time)}</span>
      </div>
      <ul className="analysis-legend" aria-label="Disciplines">
        <li className="growing-legend-actions">
          <button type="button" onClick={() => setHidden(new Set(disciplines))}>
            Uncheck all
          </button>
          <button type="button" onClick={() => setHidden(new Set())}>
            Check all
          </button>
        </li>
        {disciplines.map((discipline) => {
          const shown = !hidden.has(discipline);
          const swatch = color(discipline);
          return (
            <li key={discipline}>
              <label className={shown ? "growing-discipline" : "growing-discipline is-off"}>
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => {
                    setHidden((current) => {
                      const next = new Set(current);
                      if (next.has(discipline)) {
                        next.delete(discipline);
                      } else {
                        next.add(discipline);
                      }
                      return next;
                    });
                  }}
                />
                <span
                  className="analysis-swatch is-square"
                  style={
                    shown
                      ? { background: swatch }
                      : { background: "transparent", boxShadow: `inset 0 0 0 1.5px ${swatch}` }
                  }
                />
                {disciplineLegendLabel(discipline)}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "file";
}

function showFileOverview(snapshot: GrowingSnapshot): void {
  actions.select(snapshot.id);
  focusSidebarOverview({
    id: snapshot.id,
    name: snapshot.label,
    extension: extensionOf(snapshot.label),
    discipline: disciplineLegendLabel(snapshot.discipline),
    version: snapshot.version,
    sizeMb: snapshot.sizeMb,
    dateLabel: formatStamp(snapshot.date),
  });
}

function openFileFromCircle(snapshot: GrowingSnapshot): void {
  showFileOverview(snapshot);
  const node = getState().index?.items.find((item) => item.id === snapshot.id) ?? null;
  const canPreview = Boolean(node && node.nodeType === "file" && previewKind(node));
  actions.revealFilePreview();
  if (!canPreview) {
    void actions.openNode(snapshot.id);
  }
}

interface GrowingSnapshotMark {
  id: string;
}
