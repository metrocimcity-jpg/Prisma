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

function autoBox(this: SVGSVGElement): string {
  const { x, y, width, height } = this.getBBox();
  return [x, y, width, height].join(" ");
}

export function SunburstCanvas(): JSX.Element {
  const { vizTree, selectedId } = usePrisma();
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !vizTree) {
      if (host) {
        host.replaceChildren();
      }
      return;
    }

    const radius = Math.min(Math.max(host.clientWidth || 928, 320), Math.max(host.clientHeight || 928, 320)) / 2;
    const data = toSunburstDatum(vizTree);
    const format = d3.format(",d");

    const root = d3.partition<SunburstDatum>().size([2 * Math.PI, radius])(
      d3
        .hierarchy(data)
        .sum((d) => d.value ?? 0)
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
    );

    const color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, (root.children?.length ?? 0) + 1));

    const arc = d3
      .arc<SunburstNode>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius((d) => d.y0)
      .outerRadius((d) => d.y1 - 1);

    host.replaceChildren();
    const svg = d3
      .select(host)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("max-width", "100%")
      .style("font", "10px sans-serif")
      .style("background", "#fff");

    const arcs = root.descendants().filter((d) => d.depth > 0);

    svg
      .append("g")
      .attr("fill-opacity", 0.6)
      .selectAll<SVGPathElement, SunburstNode>("path")
      .data(arcs)
      .join("path")
      .attr("fill", (d) => {
        let current: SunburstNode = d;
        while (current.depth > 1 && current.parent) {
          current = current.parent;
        }
        return color(current.data.name);
      })
      .attr("stroke", (d) => {
        const id = resolveId(d);
        return id && id === selectedRef.current ? "#f08a24" : null;
      })
      .attr("stroke-width", (d) => {
        const id = resolveId(d);
        return id && id === selectedRef.current ? 2 : 0;
      })
      .attr("d", arc)
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        event.stopPropagation();
        actions.select(resolveId(d));
        actions.hover(resolveId(d));
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
      })
      .append("title")
      .text(
        (d) =>
          `${d
            .ancestors()
            .map((node) => node.data.name)
            .reverse()
            .join("/")}\n${format(d.value ?? 0)}`,
      );

    svg
      .append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("font-family", "sans-serif")
      .selectAll("text")
      .data(arcs.filter((d) => ((d.y0 + d.y1) / 2) * (d.x1 - d.x0) > 10))
      .join("text")
      .attr("transform", (d) => {
        const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr("dy", "0.35em")
      .text((d) => d.data.name);

    const node = svg.node();
    if (node) {
      svg.attr("viewBox", autoBox.call(node));
    }

    return () => {
      host.replaceChildren();
    };
  }, [vizTree, selectedId]);

  return <div className="viz-stage sunburst-host" ref={hostRef} />;
}
