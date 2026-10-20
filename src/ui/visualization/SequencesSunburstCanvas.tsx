import { actions, usePrisma } from "@/state/store";
import type { VizNode } from "@/visualization/types";
import * as d3 from "d3";
import { useEffect, useRef } from "react";

interface SunburstDatum {
  name: string;
  id: string;
  sourceId: string | null;
  nodeType: VizNode["nodeType"];
  value?: number;
  children?: SunburstDatum[];
}

type SunburstNode = d3.HierarchyRectangularNode<SunburstDatum>;

function toSunburstDatum(node: VizNode): SunburstDatum {
  if (node.children.length === 0) {
    return {
      name: node.label,
      id: node.id,
      sourceId: node.sourceId,
      nodeType: node.nodeType,
      value: Math.max(node.weight || node.size || 1, 1),
    };
  }
  return {
    name: node.label,
    id: node.id,
    sourceId: node.sourceId,
    nodeType: node.nodeType,
    children: node.children.map(toSunburstDatum),
  };
}

function resolveId(d: SunburstNode): string | null {
  return d.data.sourceId ?? d.data.id ?? null;
}

export function SequencesSunburstCanvas(): JSX.Element {
  const { vizTree, selectedId } = usePrisma();
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const pathRef = useRef<d3.Selection<SVGPathElement, SunburstNode, SVGGElement, unknown> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !vizTree) {
      if (host) {
        host.replaceChildren();
      }
      pathRef.current = null;
      return;
    }

    const size = Math.min(Math.max(host.clientWidth || 640, 320), Math.max(host.clientHeight || 640, 320));
    const width = size;
    const radius = width / 2;
    const data = toSunburstDatum(vizTree);

    const root = d3
      .partition<SunburstDatum>()
      .size([2 * Math.PI, radius * radius])(
        d3
          .hierarchy(data)
          .sum((d) => d.value ?? 0)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      );

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children?.length || 10 + 1));

    const arc = d3
      .arc<SunburstNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius)
      .innerRadius((d) => Math.sqrt(d.y0))
      .outerRadius((d) => Math.sqrt(d.y1) - 1);

    const mousearc = d3
      .arc<SunburstNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .innerRadius((d) => Math.sqrt(d.y0))
      .outerRadius(radius);

    host.replaceChildren();
    const svg = d3
      .select(host)
      .append("svg")
      .attr("viewBox", `${-radius} ${-radius} ${width} ${width}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("max-width", "100%")
      .style("font", "12px sans-serif")
      .style("background", "#fff");

    const visible = root.descendants().filter((d) => d.depth && d.x1 - d.x0 > 0.001);

    const path = svg
      .append("g")
      .selectAll<SVGPathElement, SunburstNode>("path")
      .data(visible)
      .join("path")
      .attr("fill", (d) => {
        let current: SunburstNode = d;
        while (current.depth > 1 && current.parent) {
          current = current.parent;
        }
        return color(current.data.name);
      })
      .attr("fill-opacity", (d) => {
        const id = resolveId(d);
        return id && id === selectedRef.current ? 1 : 0.85;
      })
      .attr("d", arc);

    pathRef.current = path;

    const label = svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#888")
      .style("visibility", "hidden");

    label
      .append("tspan")
      .attr("class", "percentage")
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "-0.1em")
      .attr("font-size", "2.4em")
      .text("");

    label
      .append("tspan")
      .attr("class", "hint")
      .attr("x", 0)
      .attr("y", 0)
      .attr("dy", "1.5em")
      .text("of total under this path");

    const nameLabel = svg
      .append("text")
      .attr("text-anchor", "middle")
      .attr("fill", "#444")
      .attr("y", 42)
      .attr("font-size", "14.4px")
      .style("visibility", "hidden")
      .text("");

    svg
      .append("g")
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mouseleave", () => {
        path.attr("fill-opacity", 0.85);
        label.style("visibility", "hidden");
        nameLabel.style("visibility", "hidden");
      })
      .selectAll<SVGPathElement, SunburstNode>("path")
      .data(visible)
      .join("path")
      .attr("d", mousearc)
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d) => {
        const sequence = d.ancestors().reverse().slice(1);
        path.attr("fill-opacity", (node) => (sequence.includes(node) ? 1 : 0.3));
        const percentage = (((100 * (d.value ?? 0)) / (root.value ?? 1)).toPrecision(3));
        label.style("visibility", null).select(".percentage").text(`${percentage}%`);
        nameLabel.style("visibility", null).text(d.data.name);
        actions.hover(resolveId(d));
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        const id = resolveId(d);
        actions.select(id);
      })
      .on("dblclick", (event, d) => {
        event.stopPropagation();
        if (d.data.nodeType !== "file") {
          return;
        }
        const id = resolveId(d);
        if (!id) {
          return;
        }
        actions.select(id);
        void actions.openNode(id);
      });

    return () => {
      pathRef.current = null;
      host.replaceChildren();
    };
  }, [vizTree]);

  useEffect(() => {
    const sel = pathRef.current;
    if (!sel) {
      return;
    }
    sel.attr("stroke", (d) => {
      const id = resolveId(d);
      return id && id === selectedId ? "#f08a24" : null;
    });
  }, [selectedId]);

  return <div className="viz-stage sequences-sunburst-host" ref={hostRef} />;
}
