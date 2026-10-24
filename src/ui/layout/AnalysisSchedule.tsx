import type { FileIndex, IndexNode } from "@/data/types";
import { actions, usePrisma } from "@/state/store";
import { AnalysisBubbleChart } from "@/ui/layout/AnalysisBubbleChart";
import { AnalysisGrowingChart } from "@/ui/layout/AnalysisGrowingChart";
import { AnalysisLineChart } from "@/ui/layout/AnalysisLineChart";
import { SidebarSelect } from "@/ui/layout/SidebarSelect";
import { analysisBubbles } from "@/ui/layout/analysisBubbles";
import { analysisLines } from "@/ui/layout/analysisLines";
import { growingFileModel, growingModel } from "@/ui/layout/growing";
import { filesInScope } from "@/ui/layout/schedule";
import { findVizNode, focusedVizNode } from "@/visualization/tree";
import type { VizNode } from "@/visualization/types";
import { useMemo, useState } from "react";

type AnalysisChart = "scatter" | "lines" | "growing-discipline" | "growing-file";

export function AnalysisSchedule(): JSX.Element {
  const { index, vizTree, focusPath, selectedId, visibleIds } = usePrisma();
  const [applyFilters, setApplyFilters] = useState(false);

  const focused = vizTree ? focusedVizNode(vizTree, focusPath) : null;
  const selectedViz = selectedId && vizTree ? findVizNode(vizTree, selectedId) : null;
  const scopeNode = selectedViz && selectedViz.nodeType !== "file" ? selectedViz : focused;
  const atRoot = Boolean(vizTree && scopeNode && scopeNode.id === vizTree.id);
  const scopeLabel = atRoot ? "All files" : (scopeNode?.label ?? "");

  const [chart, setChart] = useState<AnalysisChart>("scatter");
  const scoped = useMemo(() => chartScopeFiles(index, scopeNode, atRoot), [index, scopeNode, atRoot]);
  const files = useMemo(
    () => (applyFilters ? scoped.filter((file) => visibleIds.has(file.id)) : scoped),
    [applyFilters, scoped, visibleIds],
  );
  const bubbles = useMemo(() => analysisBubbles(files), [files]);
  const lines = useMemo(() => analysisLines(files), [files]);
  const growingDiscipline = useMemo(() => growingModel(files), [files]);
  const growingFiles = useMemo(() => growingFileModel(files), [files]);
  const growing = chart === "growing-file" ? growingFiles : growingDiscipline;
  const plotted =
    chart === "scatter" ? bubbles.length : chart === "lines" ? lines.length : growingFiles.series.length;

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
            {
              label: "Gapminder",
              children: [
                { value: "growing-discipline", label: "Discipline" },
                { value: "growing-file", label: "File" },
              ],
            },
          ]}
          onChange={(value) => setChart(value as AnalysisChart)}
        />
        <button
          type="button"
          className={applyFilters ? "analysis-filter-switch is-on" : "analysis-filter-switch"}
          role="switch"
          aria-checked={applyFilters}
          aria-label="Apply sidebar filters"
          onClick={() => setApplyFilters((current) => !current)}
        >
          <span className="analysis-filter-track" aria-hidden="true" />
          Filters
        </button>
        <button type="button" className="ghost" onClick={() => actions.setPanel("analysis", false)}>
          Close
        </button>
      </div>
      {plotted === 0 ? (
        <div className="preview-message">
          <p>
            {!index
              ? "Load a folder to plot file age, subprogram, and size."
              : applyFilters && files.length === 0 && scoped.length > 0
                ? "No files in this view match the sidebar filters."
                : chart === "lines"
                  ? "No files in this view have a subprogram and a modified date."
                  : chart === "growing-discipline" || chart === "growing-file"
                    ? "Load the AE folder. Gapminder uses the version workbook for those files."
                    : "No files in this view have a subprogram."}
          </p>
        </div>
      ) : chart === "scatter" ? (
        <AnalysisBubbleChart bubbles={bubbles} selectedId={selectedId} />
      ) : chart === "lines" ? (
        <AnalysisLineChart points={lines} />
      ) : chart === "growing-discipline" || chart === "growing-file" ? (
        <AnalysisGrowingChart
          model={growing}
          fileMode={chart === "growing-file"}
          selectedId={selectedId}
          sizeScaleMb={chart === "growing-file" ? growingDiscipline.maxSizeMb : undefined}
        />
      ) : null}
    </section>
  );
}

function chartScopeFiles(index: FileIndex | null, scopeNode: VizNode | null, atRoot: boolean): IndexNode[] {
  if (!index || !scopeNode) {
    return [];
  }
  if (atRoot) {
    return index.items.filter((item) => item.nodeType === "file");
  }
  if (scopeNode.sourceId) {
    return filesUnder(index, scopeNode.sourceId);
  }
  const byId = new Map(index.items.map((item) => [item.id, item]));
  return filesInScope(scopeNode, byId);
}

function filesUnder(index: FileIndex, folderId: string): IndexNode[] {
  const byParent = new Map<string | null, IndexNode[]>();
  for (const item of index.items) {
    const list = byParent.get(item.parentId) ?? [];
    list.push(item);
    byParent.set(item.parentId, list);
  }
  const files: IndexNode[] = [];
  const walk = (id: string): void => {
    for (const child of byParent.get(id) ?? []) {
      if (child.nodeType === "file") {
        files.push(child);
      } else {
        walk(child.id);
      }
    }
  };
  walk(folderId);
  return files;
}
