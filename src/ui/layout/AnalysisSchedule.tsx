import { actions, usePrisma } from "@/state/store";
import { AnalysisBubbleChart } from "@/ui/layout/AnalysisBubbleChart";
import { AnalysisLineChart } from "@/ui/layout/AnalysisLineChart";
import { SidebarSelect } from "@/ui/layout/SidebarSelect";
import { analysisBubbles } from "@/ui/layout/analysisBubbles";
import { analysisLines } from "@/ui/layout/analysisLines";
import { filesInScope } from "@/ui/layout/schedule";
import { findVizNode, focusedVizNode } from "@/visualization/tree";
import { useMemo, useState } from "react";

type AnalysisChart = "scatter" | "lines";

export function AnalysisSchedule(): JSX.Element {
  const { index, vizTree, focusPath, selectedId } = usePrisma();

  const focused = vizTree ? focusedVizNode(vizTree, focusPath) : null;
  const selectedViz = selectedId && vizTree ? findVizNode(vizTree, selectedId) : null;
  const scopeNode = selectedViz && selectedViz.nodeType !== "file" ? selectedViz : focused;
  const atRoot = Boolean(vizTree && scopeNode && scopeNode.id === vizTree.id);
  const scopeLabel = atRoot ? "All files" : (scopeNode?.label ?? "");

  const [chart, setChart] = useState<AnalysisChart>("scatter");
  const files = useMemo(() => {
    if (!index || !scopeNode) {
      return [];
    }
    const byId = new Map(index.items.map((item) => [item.id, item]));
    return filesInScope(scopeNode, byId);
  }, [index, scopeNode]);
  const bubbles = useMemo(() => analysisBubbles(files), [files]);
  const lines = useMemo(() => analysisLines(files), [files]);
  const plotted = chart === "scatter" ? bubbles.length : lines.length;

  return (
    <section className="analysis-schedule" aria-label="Analysis">
      <div className="settings-tools">
        <h2>Analysis</h2>
        <span className="analysis-scope" title={scopeLabel}>
          {scopeLabel}
          {plotted > 0 ? ` · ${plotted}` : ""}
        </span>
        <SidebarSelect
          id="analysis-chart"
          className="analysis-chart-select"
          ariaLabel="Analysis chart"
          value={chart}
          options={[
            { value: "scatter", label: "Age and subprogram" },
            { value: "lines", label: "Line Chart - /Subprogram/Time/FileCount" },
          ]}
          onChange={(value) => setChart(value as AnalysisChart)}
        />
        <button type="button" className="ghost" onClick={() => actions.setPanel("analysis", false)}>
          Close
        </button>
      </div>
      {plotted === 0 ? (
        <div className="preview-message">
          <p>
            {!index
              ? "Load a folder to plot file age, subprogram, and size."
              : chart === "lines"
                ? "No files in this view have a subprogram and a modified date."
                : "No files in this view have a subprogram."}
          </p>
        </div>
      ) : chart === "scatter" ? (
        <AnalysisBubbleChart bubbles={bubbles} selectedId={selectedId} />
      ) : (
        <AnalysisLineChart points={lines} />
      )}
    </section>
  );
}
