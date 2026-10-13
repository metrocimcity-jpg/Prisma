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
import { consumeSidebarSearchFocus } from "@/ui/layout/sidebarSearch";
import { useEffect, useRef, useState } from "react";

type SidebarSection = "search" | "view" | "overview" | "selection";

function searchShortcutLabel(): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return mac ? "⌘F" : "Ctrl F";
}

function SearchIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function ViewIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

function OverviewIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19v-5M12 19V9M19 19V4" />
    </svg>
  );
}

function SelectionIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

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
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState<SidebarSection>("search");
  const [searchDraft, setSearchDraft] = useState(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const viz = config.visualization;

  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft !== search) {
        actions.setSearch(searchDraft);
      }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search]);

  useEffect(() => {
    const onFocusSearch = (): void => {
      consumeSidebarSearchFocus();
      setActive("search");
      setCollapsed(false);
      window.setTimeout(() => searchRef.current?.focus(), collapsed ? 400 : 0);
    };
    window.addEventListener("prisma-focus-search", onFocusSearch);
    if (consumeSidebarSearchFocus()) {
      setActive("search");
      setCollapsed(false);
      window.setTimeout(() => searchRef.current?.focus(), collapsed ? 400 : 0);
    }
    return () => window.removeEventListener("prisma-focus-search", onFocusSearch);
  }, [collapsed]);

  function reveal(section: SidebarSection): void {
    setActive(section);
    const wasCollapsed = collapsed;
    setCollapsed(false);
    if (section === "search") {
      window.setTimeout(() => searchRef.current?.focus(), wasCollapsed ? 400 : 0);
    }
  }
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

  const rail = [
    { id: "search" as const, label: "Search", icon: <SearchIcon /> },
    { id: "view" as const, label: "File Explorer view", icon: <ViewIcon /> },
    { id: "overview" as const, label: "Overview", icon: <OverviewIcon /> },
    { id: "selection" as const, label: "File Identity", icon: <SelectionIcon /> },
  ];

  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar expanded"} aria-label="Explorer controls">
      <button
        className="sidebar-toggle"
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((current) => !current)}
      >
        {collapsed ? "›" : "‹"}
      </button>

      <nav className="sidebar-rail" aria-label="Sidebar sections">
        {rail.map((item) => (
          <button
            key={item.id}
            className={active === item.id ? "nav-btn active" : "nav-btn"}
            type="button"
            aria-label={item.label}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => reveal(item.id)}
          >
            {active === item.id ? <span className="active-rail" /> : null}
            {item.icon}
            <span className="tooltip">{item.label}</span>
          </button>
        ))}
      </nav>

      {!collapsed ? (
        <div className="sidebar-scroll" role="region" aria-label={rail.find((item) => item.id === active)?.label}>
          {active === "search" ? (
            <>
              <div className="sidebar-search search-wrap">
                <SearchIcon />
                <input
                  ref={searchRef}
                  className="search"
                  value={searchDraft}
                  placeholder="Search"
                  onChange={(event) => setSearchDraft(event.target.value)}
                  aria-label="Search"
                />
                <kbd>{searchShortcutLabel()}</kbd>
              </div>
              <FilterPanel />
            </>
          ) : null}

          {active === "view" ? (
            <div className="card" id="sidebar-section-view">
              <h3>File Explorer view</h3>
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
                Multi-Level Hierarchy
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
          ) : null}

          {active === "overview" ? (
            <div className="card" id="sidebar-section-overview">
              <h3>Overview</h3>
              {index && scope ? (
                <>
                  {!atRoot && scopeLabel ? (
                    <div className="detail-title" title={scopeLabel}>
                      {scopeLabel}
                    </div>
                  ) : null}
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
                          <span
                            className="bar-fill"
                            style={{ width: `${(entry.size / maxSize) * 100}%`, background: fill }}
                          />
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
          ) : null}

          {active === "selection" ? (
            <div id="sidebar-section-selection">
              <DetailsPanel />
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
