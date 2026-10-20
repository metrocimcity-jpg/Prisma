import { actions } from "@/state/store";
import type { AnalysisLinePoint } from "@/ui/layout/analysisLines";
import { fadeTowardGray } from "@/ui/layout/fadeColor";
import { formatDate, formatNumber } from "@/utils/format";
import { DISK_ATLAS_PALETTE } from "@/visualization/palettes";
import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";

function clipLabel(label: string, max = 42): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

export function AnalysisLineChart({ points }: { points: AnalysisLinePoint[] }): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const pickedRef = useRef<string | null>(null);
  const paintRef = useRef<(active: string | null) => void>(() => {});
  const [picked, setPicked] = useState<string | null>(null);
  const subprograms = useMemo(
    () => [...new Set(points.map((point) => point.subprogram))].sort((a, b) => a.localeCompare(b)),
    [points],
  );
  const color = d3.scaleOrdinal<string, string>(subprograms, [...d3.schemeTableau10, ...DISK_ATLAS_PALETTE]);

  useEffect(() => {
    pickedRef.current = null;
    setPicked(null);
  }, [points]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const draw = (): void => {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 240);
      const margin = { top: 28, right: 24, bottom: 36, left: 56 };
      const times = points.map((point) => point.modifiedAt);
      let [t0, t1] = d3.extent(times) as [number, number];
      if (t0 === t1) {
        const day = 24 * 60 * 60 * 1000;
        t0 -= day;
        t1 += day;
      }
      const maxCount = d3.max(points, (point) => point.fileCount) ?? 1;
      const color = d3.scaleOrdinal<string, string>(subprograms, [...d3.schemeTableau10, ...DISK_ATLAS_PALETTE]);
      const x = d3
        .scaleUtc()
        .domain([t0, t1])
        .range([margin.left, width - margin.right]);
      const y = d3
        .scaleLinear()
        .domain([0, Math.max(maxCount, 1)])
        .nice()
        .range([height - margin.bottom, margin.top]);

      host.replaceChildren();
      const svg = d3
        .select(host)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .attr("role", "img")
        .attr("aria-label", "Number of files over time. Each line is a subprogram.")
        .style("color", "var(--text)")
        .style("font-family", "var(--font-ui)")
        .style("font-size", "14.4px")
        .style("cursor", "crosshair");

      svg
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 90).tickSizeOuter(0))
        .call((group) => group.select(".domain").attr("stroke", "currentColor").attr("stroke-opacity", 0.35))
        .call((group) => group.selectAll("line").attr("stroke", "currentColor").attr("stroke-opacity", 0.35))
        .call((group) => group.selectAll("text").attr("fill", "currentColor"))
        .call((group) =>
          group
            .append("text")
            .attr("x", width - margin.right)
            .attr("y", -4)
            .attr("fill", "currentColor")
            .attr("font-weight", "700")
            .attr("text-anchor", "end")
            .text("Time"),
        );

      svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3
            .axisLeft(y)
            .ticks(5)
            .tickFormat((value) => {
              const count = Number(value);
              return Number.isInteger(count) ? formatNumber(count) : "";
            }),
        )
        .call((group) => group.select(".domain").remove())
        .call((group) =>
          group
            .selectAll(".tick line")
            .clone()
            .attr("x2", width - margin.left - margin.right)
            .attr("stroke", "currentColor")
            .attr("stroke-opacity", 0.12),
        )
        .call((group) => group.selectAll("text").attr("fill", "currentColor"))
        .call((group) =>
          group
            .append("text")
            .attr("x", 4)
            .attr("y", margin.top - 10)
            .attr("fill", "currentColor")
            .attr("font-weight", "700")
            .attr("text-anchor", "start")
            .text("Files"),
        );

      const line = d3
        .line<AnalysisLinePoint>()
        .curve(d3.curveMonotoneX)
        .x((point) => x(point.modifiedAt))
        .y((point) => y(point.fileCount));
      const series = [...d3.group(points, (point) => point.subprogram)].map(
        ([subprogram, values]) => [subprogram, [...values].sort((a, b) => a.modifiedAt - b.modifiedAt)] as const,
      );

      const path = svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .selectAll("path")
        .data(series)
        .join("path")
        .attr("d", ([, values]) => line(values));

      const marks = svg
        .append("g")
        .selectAll("circle")
        .data(points)
        .join("circle")
        .attr("cx", (point) => x(point.modifiedAt))
        .attr("cy", (point) => y(point.fileCount))
        .attr("r", 2.5)
        .attr("pointer-events", "none");

      const paint = (active: string | null): void => {
        path.attr("stroke", ([subprogram]) => (active && subprogram !== active ? fadeTowardGray(color(subprogram)) : color(subprogram)));
        marks.attr("fill", (point) =>
          active && point.subprogram !== active ? fadeTowardGray(color(point.subprogram)) : color(point.subprogram),
        );
      };
      paintRef.current = paint;
      paint(pickedRef.current);

      const dot = svg.append("g").attr("display", "none").attr("pointer-events", "none");
      dot.append("circle").attr("r", 4).attr("fill", "var(--panel)").attr("stroke-width", 2);
      dot
        .append("text")
        .attr("font-size", 14.4)
        .attr("fill", "currentColor")
        .attr("text-anchor", "middle")
        .attr("y", -10);

      const closest = (event: PointerEvent): AnalysisLinePoint | undefined => {
        const [xm, ym] = d3.pointer(event);
        return d3.least(points, (point) => Math.hypot(x(point.modifiedAt) - xm, y(point.fileCount) - ym));
      };

      const focus = (point: AnalysisLinePoint | undefined): void => {
        if (!point) {
          return;
        }
        path.filter(([subprogram]) => subprogram === point.subprogram).raise();
        paint(point.subprogram);
        dot.attr("display", null).attr("transform", `translate(${x(point.modifiedAt)},${y(point.fileCount)})`);
        dot.select("circle").attr("stroke", color(point.subprogram));
        dot
          .select("text")
          .text(
            `${clipLabel(point.name)} · ${formatDate(new Date(point.modifiedAt).toISOString())} · ${formatNumber(point.fileCount)} files`,
          );
      };

      svg
        .on("pointermove", (event: PointerEvent) => {
          focus(closest(event));
        })
        .on("pointerleave", () => {
          paint(pickedRef.current);
          dot.attr("display", "none");
        })
        .on("click", (event: PointerEvent) => {
          const point = closest(event);
          if (point) {
            actions.select(point.id);
          }
        })
        .on("dblclick", (event: PointerEvent) => {
          const point = closest(event);
          if (point) {
            void actions.openNode(point.id);
          }
        });

    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(host);
    return () => observer.disconnect();
  }, [points, subprograms]);

  return (
    <div className="analysis-chart">
      <div className="analysis-plot" ref={hostRef} />
      <ul className="analysis-legend" aria-label="Subprograms">
        {subprograms.map((subprogram) => (
          <li key={subprogram} className={picked && picked !== subprogram ? "is-faded" : undefined}>
            <button
              type="button"
              className={picked === subprogram ? "is-picked" : undefined}
              aria-pressed={picked === subprogram}
              onClick={() => {
                const next = picked === subprogram ? null : subprogram;
                pickedRef.current = next;
                setPicked(next);
                paintRef.current(next);
              }}
            >
              <span className="analysis-swatch is-line" style={{ background: color(subprogram) }} />
              {subprogram}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
