import { actions } from "@/state/store";
import { bubblesInBrush, type AnalysisBubble } from "@/ui/layout/analysisBubbles";
import { fadeTowardGray } from "@/ui/layout/fadeColor";
import { formatBytes } from "@/utils/format";
import { DISK_ATLAS_PALETTE } from "@/visualization/palettes";
import * as d3 from "d3";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

function formatWeeks(weeks: number): string {
  if (weeks < 10) {
    return weeks.toFixed(1);
  }
  return String(Math.round(weeks));
}

function clipLabel(label: string, max = 36): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

const ScatterPlot = memo(function ScatterPlot({
  bubbles,
  subprograms,
  onBrush,
  pickedRef,
  paintRef,
}: {
  bubbles: AnalysisBubble[];
  subprograms: string[];
  onBrush: (rows: AnalysisBubble[]) => void;
  pickedRef: MutableRefObject<string | null>;
  paintRef: MutableRefObject<(active: string | null) => void>;
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);
  const onBrushRef = useRef(onBrush);
  onBrushRef.current = onBrush;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const draw = (): void => {
      const width = Math.max(host.clientWidth, 320);
      const height = Math.max(host.clientHeight, 240);
      const longest = subprograms.reduce((max, label) => Math.max(max, label.length), 0);
      const margin = {
        top: 24,
        right: 30,
        bottom: 36,
        left: Math.min(260, Math.max(48, longest * 6.4 + 18)),
      };
      const maxAge = d3.max(bubbles, (bubble) => bubble.ageWeeks) ?? 1;
      const x = d3
        .scaleLinear()
        .domain([0, Math.max(maxAge, 1)])
        .nice()
        .range([margin.left, width - margin.right]);
      const y = d3
        .scalePoint()
        .domain(subprograms)
        .range([height - margin.bottom, margin.top])
        .padding(0.5);
      const color = d3.scaleOrdinal<string, string>(subprograms, [...d3.schemeTableau10, ...DISK_ATLAS_PALETTE]).unknown("#7a7f89");

      host.replaceChildren();
      const svg = d3
        .select(host)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", width)
        .attr("height", height)
        .attr("role", "img")
        .attr("aria-label", "File age in weeks by subprogram. Drag to select files. Color is subprogram.")
        .style("color", "var(--text)")
        .style("font-family", "var(--font-ui)")
        .style("font-size", "14.4px");

      svg
        .append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 90).tickFormat((value) => formatWeeks(Number(value))))
        .call((group) => group.select(".domain").remove())
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
            .text("File age (weeks)"),
        );

      svg
        .append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat((value) => clipLabel(String(value))))
        .call((group) => group.select(".domain").remove())
        .call((group) => group.selectAll("text").attr("fill", "currentColor"))
        .call((group) =>
          group
            .selectAll<SVGGElement, string>(".tick")
            .append("title")
            .text((label) => label),
        )
        .call((group) =>
          group
            .append("text")
            .attr("x", 4)
            .attr("y", margin.top - 8)
            .attr("fill", "currentColor")
            .attr("font-weight", "700")
            .attr("text-anchor", "start")
            .text("Subprogram"),
        );

      const dot = svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke-width", 1.5)
        .selectAll("circle")
        .data(bubbles)
        .join("circle")
        .attr("transform", (bubble) => `translate(${x(bubble.ageWeeks)},${y(bubble.subprogram) ?? margin.top})`)
        .attr("r", 3.5)
        .attr("stroke", (bubble) => color(bubble.subprogram));

      dot.append("title").text((bubble) =>
        [
          bubble.name,
          `Subprogram: ${bubble.subprogram}`,
          bubble.ageKnown ? `Age: ${formatWeeks(bubble.ageWeeks)} weeks` : "Age: unknown",
          `Size: ${formatBytes(bubble.size)}`,
        ].join("\n"),
      );

      const brushIds = { current: null as Set<string> | null };
      const applyColors = (): void => {
        const active = pickedRef.current;
        const chosen = brushIds.current;
        dot.style("stroke", (bubble) => {
          const full = String(color(bubble.subprogram));
          const dimmed = (active !== null && bubble.subprogram !== active) || (chosen !== null && !chosen.has(bubble.id));
          return dimmed ? fadeTowardGray(full) : full;
        });
      };

      svg
        .append("g")
        .call(
          d3
            .brush()
            .extent([
              [margin.left, margin.top],
              [width - margin.right, height - margin.bottom],
            ])
            .on("start brush end", (event: d3.D3BrushEvent<unknown>) => {
              const selection = event.selection as [[number, number], [number, number]] | null;
              const value = bubblesInBrush(bubbles, selection, (weeks) => x(weeks), (subprogram) => y(subprogram));
              brushIds.current = selection ? new Set(value.map((bubble) => bubble.id)) : null;
              applyColors();
              onBrushRef.current(selection ? value : []);
            }),
        );

      paintRef.current = () => applyColors();
      applyColors();
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(host);
    return () => observer.disconnect();
  }, [bubbles, paintRef, pickedRef, subprograms]);

  return <div className="analysis-plot" ref={hostRef} />;
});

export function AnalysisBubbleChart({
  bubbles,
  selectedId,
}: {
  bubbles: AnalysisBubble[];
  selectedId: string | null;
}): JSX.Element {
  const [brushed, setBrushed] = useState<AnalysisBubble[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedRef = useRef<string | null>(null);
  const paintRef = useRef<(active: string | null) => void>(() => {});
  const onBrush = useCallback((rows: AnalysisBubble[]) => {
    setBrushed(rows);
  }, []);
  const subprograms = useMemo(
    () => [...new Set(bubbles.map((bubble) => bubble.subprogram))].sort((a, b) => a.localeCompare(b)),
    [bubbles],
  );
  const color = d3.scaleOrdinal<string, string>(subprograms, [...d3.schemeTableau10, ...DISK_ATLAS_PALETTE]);

  useEffect(() => {
    pickedRef.current = null;
    setPicked(null);
    setBrushed([]);
  }, [bubbles]);

  return (
    <div className="analysis-chart">
      <ScatterPlot bubbles={bubbles} subprograms={subprograms} onBrush={onBrush} pickedRef={pickedRef} paintRef={paintRef} />
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
              <span className="analysis-swatch" style={{ borderColor: color(subprogram) }} />
              {subprogram}
            </button>
          </li>
        ))}
      </ul>
      <p className="analysis-brush-note">{brushed.length === 0 ? "Drag on the chart to select files." : `${brushed.length} selected`}</p>
      {brushed.length > 0 ? (
        <div className="analysis-brush-list">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Subprogram</th>
                <th>Age</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {brushed.map((row) => (
                <tr
                  key={row.id}
                  className={row.id === selectedId ? "is-selected" : undefined}
                  onClick={() => actions.select(row.id)}
                  onDoubleClick={() => {
                    void actions.openNode(row.id);
                  }}
                >
                  <td title={row.name}>{row.name}</td>
                  <td title={row.subprogram}>{row.subprogram}</td>
                  <td>{row.ageKnown ? `${formatWeeks(row.ageWeeks)} wk` : "unknown"}</td>
                  <td>{formatBytes(row.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
