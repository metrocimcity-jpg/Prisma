import { FilterPanel } from "@/ui/layout/FilterPanel";
import { DetailsPanel } from "@/ui/layout/DetailsPanel";
import { actions, usePrisma } from "@/state/store";
import { collectMetadataKeys } from "@/data/metadataKeys";
import { colorForExt } from "@/visualization/palettes";
import { scopeStats } from "@/visualization/scopeStats";
import { findVizNode, focusedVizNode } from "@/visualization/tree";
import { formatBytes, formatNumber } from "@/utils/format";
import { isFilterActive } from "@/filtering/FilterEngine";
import { HierarchyList } from "@/ui/layout/HierarchyList";
import { hierarchyCatalog } from "@/ui/layout/hierarchy";
import type { ColorBy, GroupBy, GroupLevel, LayoutMode } from "@/visualization/types";
import { indexShowsAccTaxonomy } from "@/metadata/accTaxonomy";

const ACC_GROUP_BY = new Set<string>([
  "accPortfolio",
  "accProgram",
  "accSubProgram",
  "accOriginator",
  "accLocation",
  "accDiscipline",
  "accDocumentType",
]);

const GROUP_PRESETS = new Set([
  "folder",
  "extension",
  "extension,size",
  "size",
  "date",
  "date,extension",
  "category",
  "category,fileType,extension",
  "accPortfolio",
  "accProgram",
  "accSubProgram",
  "accOriginator",
  "accLocation",
  "accDiscipline",
  "accDocumentType",
  "custom",
]);

function groupValue(groupBy: GroupLevel[]): string {
  if (groupBy.length === 1 && groupBy[0] === "folder") {
    return "folder";
  }
  if (groupBy.length === 1 && groupBy[0] === "custom") {
    return "custom";
  }
  return groupBy.join(",");
}

function hierarchySummary(groupBy: readonly GroupLevel[], metadataKeys: readonly string[]): string {
  const labels = new Map(hierarchyCatalog(metadataKeys).map((field) => [field.id, field.label]));
  return groupBy.map((id) => labels.get(id) ?? id).join(" → ");
}

function formatPropertyLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Sidebar(): JSX.Element {
  const { config, index, vizTree, focusPath, selectedId, search, filters } = usePrisma();
  const viz = config.visualization;
  const matching = search.trim().length > 0 || isFilterActive(filters);
  const metadataKeys = collectMetadataKeys(index);
  const showAccGroups = indexShowsAccTaxonomy(index);
  const focused = vizTree ? focusedVizNode(vizTree, focusPath) : null;
  const selectedViz = selectedId && vizTree ? findVizNode(vizTree, selectedId) : null;
  const scopeNode = selectedViz && selectedViz.nodeType !== "file" ? selectedViz : focused;
  const scope = scopeNode ? scopeStats(scopeNode) : null;
  const atRoot = Boolean(vizTree && scopeNode && scopeNode.id === vizTree.id);
  const scopeLabel = atRoot ? "All files" : (scopeNode?.label ?? "");
  const top = scope?.types.slice(0, 8) ?? [];
  const maxSize = top[0]?.size ?? 1;
  const scopeSize = scope?.totalSize ?? 0;
  const stacking = viz.style.stacking;

  return (
    <aside className="sidebar" aria-label="Explorer controls">
      <FilterPanel />

      <div className="card">
        <h3>View</h3>
        <label className="field-label" htmlFor="group-by">
          Group by
        </label>
        <select
          id="group-by"
          value={groupValue(viz.groupBy)}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "custom") {
              const property = viz.customProperty || metadataKeys[0] || "";
              actions.patchVisualization({ groupBy: ["custom"], customProperty: property });
              return;
            }
            const groups = value.split(",") as GroupBy[];
            const accLabels = ACC_GROUP_BY.has(groups[0] ?? "");
            actions.patchVisualization({
              groupBy: groups,
              ...(accLabels
                ? {
                    style: {
                      groupLabelMinFontSize: 4,
                      groupLabelMaxFontSize: 22,
                    },
                  }
                : {}),
            });
          }}
        >
          <option value="folder">Folder structure</option>
          <option value="extension">File type</option>
          <option value="extension,size">File type → size</option>
          <option value="size">Size</option>
          <option value="date">Date modified</option>
          <option value="date,extension">Date modified → type</option>
          <option value="category">Category</option>
          <option value="category,fileType,extension">Category → Type → Ext</option>
          {showAccGroups ? (
            <>
              <option value="accPortfolio">ACC-Portfolio</option>
              <option value="accProgram">ACC-Program</option>
              <option value="accSubProgram">ACC-Sub Program</option>
              <option value="accOriginator">ACC-Originator</option>
              <option value="accLocation">ACC-Location</option>
              <option value="accDiscipline">ACC-Discipline</option>
              <option value="accDocumentType">ACC-Document Type</option>
            </>
          ) : null}
          {metadataKeys.length > 0 ? <option value="custom">Document metadata…</option> : null}
          {!GROUP_PRESETS.has(groupValue(viz.groupBy)) ? (
            <option value={groupValue(viz.groupBy)}>{hierarchySummary(viz.groupBy, metadataKeys)}</option>
          ) : null}
        </select>

        <label className="field-label" htmlFor="hierarchy">
          Hierarchy
        </label>
        <HierarchyList
          metadataKeys={metadataKeys}
          groupBy={viz.groupBy}
          onChange={(groupBy) => {
            const accLabels = ACC_GROUP_BY.has(groupBy[0] ?? "");
            actions.patchVisualization({
              groupBy,
              ...(accLabels
                ? {
                    style: {
                      groupLabelMinFontSize: 4,
                      groupLabelMaxFontSize: 22,
                    },
                  }
                : {}),
            });
          }}
        />

        <label className="field-label" htmlFor="color-by">
          Color by
        </label>
        <select
          id="color-by"
          value={viz.colorBy}
          onChange={(event) => {
            const value = event.target.value as ColorBy;
            if (value === "custom") {
              const property = viz.customProperty || metadataKeys[0] || "";
              actions.patchVisualization({ colorBy: "custom", customProperty: property });
              return;
            }
            actions.patchVisualization({ colorBy: value });
          }}
        >
          <option value="extension">File type</option>
          <option value="fileSize">Size</option>
          <option value="modifiedDate">Recency</option>
          <option value="category">Category</option>
          <option value="folder">Folder</option>
          {metadataKeys.length > 0 ? <option value="custom">Document metadata…</option> : null}
        </select>

        {metadataKeys.length > 0 && (viz.groupBy[0] === "custom" || viz.colorBy === "custom") ? (
          <>
            <label className="field-label" htmlFor="custom-property">
              Metadata property
            </label>
            <select
              id="custom-property"
              value={viz.customProperty || metadataKeys[0]}
              onChange={(event) => actions.patchVisualization({ customProperty: event.target.value })}
            >
              {metadataKeys.map((key) => (
                <option key={key} value={key}>
                  {formatPropertyLabel(key)}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label className="field-label" htmlFor="display">
          Display
        </label>
        <select
          id="display"
          value={stacking}
          onChange={(event) =>
            actions.patchVisualization({
              layout: (event.target.value === "flattened" ? "sunburst" : "foam") as LayoutMode,
              style: {
                stacking: event.target.value === "flattened" ? "flattened" : "hierarchical",
                foamLayout: "relaxed",
              },
            })
          }
        >
          <option value="flattened">Flattened (see all levels)</option>
          <option value="hierarchical">Hierarchical (drill down)</option>
        </select>
      </div>

      <div className="card">
        <h3>Overview</h3>
        {index && scope ? (
          <>
            <div className="detail-title" title={scopeLabel}>
              {scopeLabel}
            </div>
            <div className="stat-line">
              <span className="k">Files</span>
              <span className="v">{formatNumber(scope.fileCount)}</span>
            </div>
            <div className="stat-line">
              <span className="k">Total size</span>
              <span className="v">{formatBytes(scopeSize)}</span>
            </div>
            {scope.groupCount > 0 ? (
              <div className="stat-line">
                <span className="k">Groups</span>
                <span className="v">{formatNumber(scope.groupCount)}</span>
              </div>
            ) : null}
            {matching && atRoot && scope.fileCount !== index.statistics.totalFiles ? (
              <div className="stat-line">
                <span className="k">In project</span>
                <span className="v accentv">{formatNumber(index.statistics.totalFiles)}</span>
              </div>
            ) : null}
            <label className="field-label">Top types by size</label>
            {top.length === 0 ? <div className="detail-empty">No files in this view.</div> : null}
            {top.map((entry) => {
              const pct = scopeSize ? (entry.size / scopeSize) * 100 : 0;
              const fill = colorForExt(entry.ext === "no extension" ? null : entry.ext);
              return (
                <div className="legend-row" key={entry.ext}>
                  <span className="sw" style={{ background: fill }} />
                  <span className="name" title={entry.ext}>
                    {entry.ext}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(entry.size / maxSize) * 100}%`, background: fill }} />
                  </span>
                  <span className="pct">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </>
        ) : (
          <div className="detail-empty">Load a folder to see totals and type breakdown.</div>
        )}
      </div>

      <DetailsPanel />
    </aside>
  );
}
