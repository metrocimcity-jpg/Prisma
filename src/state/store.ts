import type { FileIndex, IndexNode, ScanProgress } from "@/data/types";
import { indexToCsv, serializeIndex, enrichFileIndexWithAccTaxonomy } from "@/data/aggregate";
import { indexShowsAccTaxonomy } from "@/metadata/accTaxonomy";
import { parseIndexJson } from "@/data/validate";
import { createSampleIndex } from "@/data/sampleIndex";
import { cloneConfig, defaultAppConfig, type AppConfig, type SavedPreset } from "@/config/defaults";
import { builtinPresets } from "@/config/presets";
import { createWorkspace, isWorkspaceFile, type WorkspaceFile } from "@/config/workspace";
import { defaultFilterEngine, emptyFilterState, isFilterActive, type FilterState } from "@/filtering/FilterEngine";
import { defaultSearchEngine } from "@/search/SearchEngine";
import { startDirectoryScan } from "@/scanner/scanJob";
import type { HandleMap } from "@/scanner/FileScanner";
import {
  directoryHandleKey,
  ensureReadPermission,
  loadDirectoryHandle,
  resolveFileInFolder,
  saveDirectoryHandle,
} from "@/scanner/localFolderLink";
import { mergeFileIndexes } from "@/data/mergeIndex";
import { downloadText } from "@/utils/format";
import { beginAccLogin, clearAccToken, completeAccLoginFromUrl, isAccSignedIn } from "@/acc/auth";
import { applySavedAccAttributes, loadAccAttributeCache, rememberAccMetadataDocument, saveAccAttributeCache } from "@/acc/attributeCache";
import { parseAccMetadataDocument } from "@/acc/metadataDocument";
import { installSavedAccMetadataDefaults } from "@/acc/savedDefaults";
import { accMetadataDocument, resolveAccLinks as enrichIndexWithAccLinks } from "@/acc/resolveLinks";
import { loadAccSettings, saveAccSettings, type AccSettings } from "@/acc/settings";
import {
  beginSharePointLogin,
  clearSharePointToken,
  completeSharePointLoginFromUrl,
  isSharePointSignedIn,
} from "@/sharepoint/auth";
import { listAccessibleSites, listSiteDrives, resolveDriveFromLibraryUrl, type GraphDrive, type GraphSite } from "@/sharepoint/graph";
import { importSharePointDrive as buildSharePointIndex } from "@/sharepoint/importDrive";
import { loadSharePointSettings, saveSharePointSettings, type SharePointSettings } from "@/sharepoint/settings";
import { describeAccLinkError, normalizeAccWebUrl } from "@/utils/accLinks";
import { openWebUrl, openableWebUrlFromMetadata } from "@/utils/webLinks";
import { copyText, openLocalFileHandle, readLocalFile } from "@/utils/openFile";
import { previewKind } from "@/utils/previewKind";
import { buildGroupedTree, buildSemanticResultTree } from "@/visualization/grouping";
import { applyStylePreset as composeStylePreset, stylePresets } from "@/visualization/foamtree/stylePresets";
import type { GroupBy, VisualizationStyle, VizNode } from "@/visualization/types";
import { useSyncExternalStore } from "react";

const ACC_GROUP_BY_VALUES = new Set<string>([
  "accPortfolio",
  "accProgram",
  "accSubProgram",
  "accOriginator",
  "accLocation",
  "accDiscipline",
  "accDocumentType",
]);

export interface PrismaState {
  index: FileIndex | null;
  handles: HandleMap;
  scan: ScanProgress | null;
  scanning: boolean;
  loadError: string | null;
  selectedId: string | null;
  hoveredId: string | null;
  focusPath: string[];
  search: string;
  /** File ids from the last Ask Prisma / semantic search, highlighted on FoamTree. */
  semanticHitIds: string[];
  semanticAsk: string;
  filters: FilterState;
  config: AppConfig;
  panels: {
    filters: boolean;
    details: boolean;
    settings: boolean;
    preview: boolean;
    analysis: boolean;
    commandPalette: boolean;
    sharePointBrowser: boolean;
  };
  presets: SavedPreset[];
  visibleIds: Set<string>;
  visibleCount: number;
  vizTree: VizNode | null;
  acc: {
    settings: AccSettings;
    signedIn: boolean;
    resolving: boolean;
    resolveMessage: string | null;
  };
  sharePoint: {
    settings: SharePointSettings;
    signedIn: boolean;
    importing: boolean;
    message: string | null;
  };
}

const listeners = new Set<() => void>();

let scanCancel: (() => void) | null = null;
let sharePointImportCancel = false;
let linkedDirectory: FileSystemDirectoryHandle | null = null;
let linkedDirectoryKey: string | null = null;
let directoryPrefetch: Promise<void> | null = null;

/** View before the latest Ask Prisma map — restored by Escape / Backspace. */
interface SemanticViewSnapshot {
  search: string;
  filters: FilterState;
  focusPath: string[];
  selectedId: string | null;
}

let semanticViewSnapshot: SemanticViewSnapshot | null = null;

function cloneFilters(filters: FilterState): FilterState {
  return {
    ...filters,
    extensions: [...filters.extensions],
    categories: [...filters.categories],
    fileTypes: [...filters.fileTypes],
  };
}

function clearSemanticSnapshot(): void {
  semanticViewSnapshot = null;
}

function rememberDirectory(index: FileIndex, handle: FileSystemDirectoryHandle): void {
  linkedDirectory = handle;
  linkedDirectoryKey = directoryHandleKey(index);
  void saveDirectoryHandle(linkedDirectoryKey, handle);
}

function prefetchLinkedDirectory(index: FileIndex): void {
  const key = directoryHandleKey(index);
  linkedDirectory = null;
  linkedDirectoryKey = key;
  directoryPrefetch = loadDirectoryHandle(key)
    .then((handle) => {
      if (handle && linkedDirectoryKey === key) {
        linkedDirectory = handle;
      }
    })
    .catch(() => undefined);
}

async function permittedLinkedDirectory(index: FileIndex): Promise<FileSystemDirectoryHandle | null> {
  if (directoryPrefetch) {
    await directoryPrefetch;
  }
  const key = directoryHandleKey(index);
  if (linkedDirectory && linkedDirectoryKey === key && (await ensureReadPermission(linkedDirectory))) {
    return linkedDirectory;
  }
  return null;
}

async function pickOriginalFolder(index: FileIndex): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error("Folder picking requires Chrome or Edge with the File System Access API.");
  }
  setState({
    loadError: null,
    acc: {
      ...state.acc,
      resolveMessage: `Pick “${index.root.name}” — the folder this JSON was scanned from — to open the file.`,
    },
  });
  try {
    return await window.showDirectoryPicker({ mode: "read", id: "prisma-local-folder" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Folder selection cancelled.");
    }
    throw error;
  }
}

let state: PrismaState = {
  index: null,
  handles: new Map(),
  scan: null,
  scanning: false,
  loadError: null,
  selectedId: null,
  hoveredId: null,
  focusPath: [],
  search: "",
  semanticHitIds: [],
  semanticAsk: "",
  filters: emptyFilterState(),
  config: defaultAppConfig(),
  panels: { filters: true, details: true, settings: false, preview: false, analysis: false, commandPalette: false, sharePointBrowser: false },
  presets: builtinPresets,
  visibleIds: new Set(),
  visibleCount: 0,
  vizTree: null,
  acc: {
    settings: loadAccSettings(),
    signedIn: isAccSignedIn(),
    resolving: false,
    resolveMessage: null,
  },
  sharePoint: {
    settings: loadSharePointSettings(),
    signedIn: isSharePointSignedIn(),
    importing: false,
    message: null,
  },
};

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setState(partial: Partial<PrismaState>): void {
  state = { ...state, ...partial };
  emit();
}

function nodeMap(index: FileIndex): Map<string, IndexNode> {
  return new Map(index.items.map((item) => [item.id, item]));
}

function expandAncestors(index: FileIndex, ids: Set<string>): Set<string> {
  const byId = nodeMap(index);
  const visible = new Set(ids);
  for (const id of ids) {
    let current = byId.get(id);
    while (current?.parentId) {
      visible.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }
  visible.add(index.root.id);
  return visible;
}

function recompute(next: Partial<PrismaState> = {}): void {
  if (next.index) {
    const applied = applySavedAccAttributes(next.index, state.acc.settings.projectId);
    if (applied.applied > 0) {
      const folderName = next.index.root?.name ?? "this folder";
      next = {
        ...next,
        index: applied.index,
        acc:
          next.acc ??
          {
            ...state.acc,
            resolveMessage: `Using the saved ACC attributes for “${folderName}” on ${applied.applied} files.`,
          },
      };
    }
  }
  const merged: PrismaState = { ...state, ...next };
  if (!merged.index) {
    state = {
      ...merged,
      visibleIds: new Set(),
      visibleCount: 0,
      vizTree: null,
    };
    emit();
    return;
  }

  const items = merged.index.items;
  const sizeBy = merged.config.visualization.sizeBy;
  const customProperty = merged.config.visualization.customProperty;

  // Ask Prisma: temporary flat JSON — hit files as siblings side-by-side on FoamTree.
  if (merged.semanticHitIds.length > 0) {
    const hitSet = new Set(merged.semanticHitIds);
    const matchedFiles = new Set<string>();
    for (const id of merged.semanticHitIds) {
      const node = items.find((item) => item.id === id);
      if (node?.nodeType === "file") {
        matchedFiles.add(id);
      }
    }
    const vizTree = buildSemanticResultTree(
      merged.index,
      [...hitSet],
      sizeBy,
      customProperty,
      matchedFiles.size === 1 ? "Ask result" : `${matchedFiles.size} Ask results`,
    );
    state = {
      ...merged,
      visibleIds: matchedFiles,
      visibleCount: matchedFiles.size,
      vizTree,
    };
    emit();
    return;
  }

  const filterIds = defaultFilterEngine.apply(items, merged.filters);
  const searchHits = merged.search.trim().length > 0 ? defaultSearchEngine.search(items, merged.search) : null;
  const searchIds = searchHits ? new Set(searchHits.map((hit) => hit.id)) : null;
  const files = items.filter((item) => item.nodeType === "file");
  const matchedFiles = new Set<string>();
  for (const file of files) {
    const passesFilter = !isFilterActive(merged.filters) || filterIds.has(file.id);
    const passesSearch = searchIds === null || searchIds.has(file.id);
    if (passesFilter && passesSearch) {
      matchedFiles.add(file.id);
    }
  }
  if (searchIds) {
    for (const id of searchIds) {
      const node = items.find((item) => item.id === id);
      if (node?.nodeType === "folder") {
        matchedFiles.add(id);
      }
    }
  }
  const visibleIds = expandAncestors(merged.index, matchedFiles);
  const vizTree = buildGroupedTree(
    merged.index,
    visibleIds,
    merged.config.visualization.groupBy,
    sizeBy,
    customProperty,
  );
  state = {
    ...merged,
    visibleIds,
    visibleCount: matchedFiles.size,
    vizTree,
  };
  emit();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): PrismaState {
  return state;
}

export function usePrisma(): PrismaState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export const actions = {
  setSearch(search: string): void {
    clearSemanticSnapshot();
    recompute({ search, semanticHitIds: [], semanticAsk: "" });
  },
  /** Pin Ask Prisma hits on a temporary FoamTree layout (hits as adjacent siblings). */
  setSemanticHits(ask: string, hitIds: string[]): void {
    if (state.semanticHitIds.length === 0) {
      semanticViewSnapshot = {
        search: state.search,
        filters: cloneFilters(state.filters),
        focusPath: [...state.focusPath],
        selectedId: state.selectedId,
      };
    }
    recompute({
      semanticAsk: ask,
      semanticHitIds: [...new Set(hitIds)],
      focusPath: [],
      selectedId: hitIds[0] ?? null,
    });
  },
  /** Leave Ask Prisma and restore search / filters / selection from before the ask. */
  clearSemanticHits(): void {
    const snapshot = semanticViewSnapshot;
    clearSemanticSnapshot();
    if (snapshot) {
      recompute({
        semanticHitIds: [],
        semanticAsk: "",
        search: snapshot.search,
        filters: snapshot.filters,
        focusPath: snapshot.focusPath,
        selectedId: snapshot.selectedId,
      });
      return;
    }
    recompute({ semanticHitIds: [], semanticAsk: "", search: "" });
  },
  setFilters(filters: FilterState): void {
    clearSemanticSnapshot();
    recompute({ filters, focusPath: [], semanticHitIds: [], semanticAsk: "" });
  },
  patchFilters(patch: Partial<FilterState>): void {
    recompute({ filters: { ...state.filters, ...patch }, focusPath: [] });
  },
  clearFilters(): void {
    clearSemanticSnapshot();
    recompute({ filters: emptyFilterState(), search: "", focusPath: [], semanticHitIds: [], semanticAsk: "" });
  },
  patchConfig(patch: Partial<AppConfig>): void {
    recompute({ config: { ...state.config, ...patch } });
  },
  patchVisualization(patch: Partial<Omit<AppConfig["visualization"], "style">> & { style?: Partial<VisualizationStyle> }): void {
    const { style: stylePatch, ...rest } = patch;
    const visualization = {
      ...state.config.visualization,
      ...rest,
      style: stylePatch
        ? { ...state.config.visualization.style, ...stylePatch }
        : state.config.visualization.style,
    };
    const resetFocus = patch.groupBy !== undefined || patch.layout !== undefined;
    recompute({
      config: { ...state.config, visualization },
      focusPath: resetFocus ? [] : state.focusPath,
    });
  },
  patchStyle(patch: Partial<AppConfig["visualization"]["style"]>): void {
    recompute({
      config: {
        ...state.config,
        visualization: {
          ...state.config.visualization,
          style: { ...state.config.visualization.style, ...patch },
        },
      },
    });
  },
  resetStyle(): void {
    const defaults = defaultAppConfig();
    recompute({
      config: {
        ...state.config,
        visualization: {
          ...state.config.visualization,
          style: defaults.visualization.style,
          palette: defaults.visualization.palette,
        },
      },
    });
  },
  setTheme(theme: AppConfig["theme"]): void {
    document.documentElement.dataset.theme = theme;
    recompute({ config: { ...state.config, theme } });
  },
  select(id: string | null): void {
    const file = id ? fileNodeById(id) : null;
    const showPreview = Boolean(file && previewKind(file) && !state.panels.analysis);
    if (state.selectedId === id && !(showPreview && (!state.panels.preview || state.panels.settings))) {
      return;
    }
    setState({
      selectedId: id,
      ...(showPreview ? { panels: { ...state.panels, preview: true, settings: false } } : {}),
    });
  },
  hover(id: string | null): void {
    if (state.hoveredId === id) {
      return;
    }
    setState({ hoveredId: id });
  },
  drillInto(vizId: string): void {
    setState({ focusPath: [...state.focusPath, vizId], selectedId: null });
  },
  setFocusPath(focusPath: string[]): void {
    if (focusPath.length === state.focusPath.length && focusPath.every((id, index) => id === state.focusPath[index])) {
      return;
    }
    setState({ focusPath, selectedId: null });
  },
  navigateBack(): void {
    if (state.semanticHitIds.length > 0) {
      actions.clearSemanticHits();
      return;
    }
    if (state.focusPath.length === 0) {
      setState({ selectedId: null });
      return;
    }
    setState({ focusPath: state.focusPath.slice(0, -1), selectedId: null });
  },
  togglePanel(panel: "filters" | "details"): void {
    setState({ panels: { ...state.panels, [panel]: !state.panels[panel] } });
  },
  setPanel(panel: "settings" | "preview" | "analysis" | "commandPalette" | "sharePointBrowser", open: boolean): void {
    const panels = { ...state.panels, [panel]: open };
    if (open && panel === "settings") {
      panels.preview = false;
      panels.analysis = false;
    }
    if (open && panel === "preview") {
      panels.settings = false;
      panels.analysis = false;
    }
    if (open && panel === "analysis") {
      panels.preview = false;
      panels.settings = false;
    }
    setState({ panels });
  },
  async loadLocalPreview(
    id: string,
    pick: boolean,
  ): Promise<
    | { status: "ready"; name: string; file: File }
    | { status: "missing"; name: string }
    | { status: "cancelled" }
    | { status: "unsupported"; name: string }
    | { status: "empty" }
    | { status: "error"; message: string }
  > {
    const node = fileNodeById(id);
    if (!node) {
      return { status: "empty" };
    }
    if (!previewKind(node)) {
      return { status: "unsupported", name: node.name };
    }
    try {
      const resolved = await localFileHandle(node, pick);
      if (resolved === "cancelled") {
        return { status: "cancelled" };
      }
      if (resolved === "missing" || resolved === "stale") {
        return { status: "missing", name: node.name };
      }
      const file = await readLocalFile(resolved);
      return { status: "ready", name: node.name, file };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : "Could not read the file",
      };
    }
  },
  applyPreset(preset: SavedPreset): void {
    document.documentElement.dataset.theme = preset.theme;
    recompute({
      config: { theme: preset.theme, visualization: structuredClone(preset.visualization) },
      filters: structuredClone(preset.filters),
      focusPath: [],
    });
  },
  applyStylePreset(id: string): void {
    const preset = stylePresets.find((item) => item.id === id);
    if (!preset) {
      return;
    }
    recompute({
      config: {
        ...state.config,
        visualization: composeStylePreset(state.config.visualization, preset),
      },
      focusPath: preset.visualization?.layout !== undefined || preset.style.stacking !== undefined ? [] : state.focusPath,
    });
  },
  loadSample(): void {
    linkedDirectory = null;
    linkedDirectoryKey = null;
    directoryPrefetch = null;
    clearSemanticSnapshot();
    recompute({
      index: createSampleIndex(),
      handles: new Map(),
      loadError: null,
      selectedId: null,
      focusPath: [],
      scan: null,
      search: "",
      semanticHitIds: [],
      semanticAsk: "",
      filters: emptyFilterState(),
    });
  },
  loadIndex(index: FileIndex): void {
    const enriched = enrichFileIndexWithAccTaxonomy(index);
    const nextConfig =
      ACC_GROUP_BY_VALUES.has(state.config.visualization.groupBy[0] ?? "") && !indexShowsAccTaxonomy(enriched)
        ? {
            ...state.config,
            visualization: { ...state.config.visualization, groupBy: ["folder"] as GroupBy[] },
          }
        : state.config;
    prefetchLinkedDirectory(enriched);
    recompute({
      index: enriched,
      handles: new Map(),
      loadError: null,
      selectedId: null,
      focusPath: [],
      scan: null,
      config: nextConfig,
    });
  },
  async openFolder(): Promise<void> {
    if (!window.showDirectoryPicker) {
      setState({ loadError: "Folder picking requires Chrome or Edge with the File System Access API." });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      scanCancel?.();
      setState({ scanning: true, loadError: null, scan: preparingScan(handle.name) });
      const job = startDirectoryScan(handle, (progress) => {
        setState({ scan: progress, scanning: progress.phase !== "complete" && progress.phase !== "cancelled" });
      });
      scanCancel = job.cancel;
      const result = await job.done;
      await loadAccAttributeCache();
      await importAccMetadataFiles(result.handles, result.index.root.name);
      rememberDirectory(result.index, handle);
      const emptyFailure =
        result.index.statistics.totalFiles === 0 && result.index.errors.length > 0
          ? result.index.errors[0]?.message ?? "Folder scan failed"
          : null;
      recompute({
        index: enrichFileIndexWithAccTaxonomy(result.index),
        handles: result.handles,
        scanning: false,
        selectedId: null,
        focusPath: [],
        loadError: emptyFailure,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ scanning: false });
        return;
      }
      setState({
        scanning: false,
        loadError: error instanceof Error ? error.message : "Folder scan failed",
      });
    }
  },
  cancelScan(): void {
    scanCancel?.();
    setState({ scanning: false, scan: state.scan ? { ...state.scan, phase: "cancelled" } : null });
  },
  async openJson(): Promise<void> {
    try {
      const text = await pickTextFile([
        { description: "Prisma index or workspace", accept: { "application/json": [".json"] } },
      ]);
      if (text === null) {
        return;
      }
      const parsed: unknown = JSON.parse(text);
      if (parseAccMetadataDocument(parsed)) {
        const folderName = state.index?.root.name ?? "";
        if (!folderName) {
          setState({ loadError: "Load the folder first, then open the ACC metadata JSON." });
          return;
        }
        rememberAccMetadataDocument(parsed, folderName, new Date().toISOString());
        recompute({ index: state.index ?? undefined });
        return;
      }
      if (isWorkspaceFile(parsed)) {
        applyWorkspace(parsed);
        return;
      }
      const result = parseIndexJson(text);
      if (!result.ok || !result.index) {
        setState({ loadError: result.errors.join("; ") });
        return;
      }
      actions.loadIndex(result.index);
    } catch (error) {
      setState({ loadError: error instanceof Error ? error.message : "Could not open JSON" });
    }
  },
  async mergeFolder(): Promise<void> {
    if (!window.showDirectoryPicker) {
      setState({ loadError: "Folder picking requires Chrome or Edge with the File System Access API." });
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "read" });
      scanCancel?.();
      setState({ scanning: true, loadError: null, scan: preparingScan(handle.name) });
      const job = startDirectoryScan(handle, (progress) => {
        setState({ scan: progress, scanning: progress.phase !== "complete" && progress.phase !== "cancelled" });
      });
      scanCancel = job.cancel;
      const result = await job.done;
      if (!state.index) {
        recompute({
          index: result.index,
          handles: result.handles,
          scanning: false,
          selectedId: null,
          focusPath: [],
          loadError: null,
          acc: {
            ...state.acc,
            resolveMessage: `Loaded “${result.index.root.name}”. Use Merge folder to add more batches.`,
          },
        });
        return;
      }
      const merged = mergeFileIndexes(state.index, state.handles, result.index, result.handles, handle.name);
      recompute({
        index: merged.index,
        handles: merged.handles,
        scanning: false,
        selectedId: null,
        focusPath: [],
        loadError: null,
        acc: {
          ...state.acc,
          resolveMessage: `Merged “${merged.batchName}” · ${merged.index.statistics.totalFiles} files total`,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setState({ scanning: false });
        return;
      }
      setState({
        scanning: false,
        loadError: error instanceof Error ? error.message : "Merge folder failed",
      });
    }
  },
  async mergeJson(): Promise<void> {
    try {
      const text = await pickTextFile([
        { description: "Prisma index JSON", accept: { "application/json": [".json"] } },
      ]);
      if (text === null) {
        return;
      }
      const parsed: unknown = JSON.parse(text);
      if (isWorkspaceFile(parsed)) {
        setState({ loadError: "Workspace files cannot be merged. Open an index JSON, or use Merge folder." });
        return;
      }
      const result = parseIndexJson(text);
      if (!result.ok || !result.index) {
        setState({ loadError: result.errors.join("; ") });
        return;
      }
      if (!state.index) {
        actions.loadIndex(result.index);
        setState({
          acc: {
            ...state.acc,
            resolveMessage: `Loaded “${result.index.root.name}” from JSON. Use Merge folder/JSON to add more batches.`,
          },
        });
        return;
      }
      const merged = mergeFileIndexes(state.index, state.handles, result.index, new Map(), result.index.root.name);
      recompute({
        index: merged.index,
        handles: merged.handles,
        selectedId: null,
        focusPath: [],
        loadError: null,
        acc: {
          ...state.acc,
          resolveMessage: `Merged “${merged.batchName}” from JSON · ${merged.index.statistics.totalFiles} files total`,
        },
      });
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Merge JSON failed",
      });
    }
  },
  exportJson(): void {
    if (!state.index) {
      return;
    }
    downloadText(`${state.index.root.name}.index.json`, serializeIndex(state.index));
  },
  exportCsv(): void {
    if (!state.index) {
      return;
    }
    downloadText(`${state.index.root.name}.csv`, indexToCsv(state.index), "text/csv");
  },
  exportWorkspace(): void {
    const workspace = createWorkspace({
      indexName: state.index?.root.name ?? null,
      indexGeneratedAt: state.index?.generatedAt ?? null,
      search: state.search,
      selectedId: state.selectedId,
      focusPath: state.focusPath,
      filters: state.filters,
      config: cloneConfig(state.config),
      panels: { filters: state.panels.filters, details: state.panels.details },
    });
    downloadText("prisma.workspace.json", `${JSON.stringify(workspace, null, 2)}\n`);
  },
  resetVisualization(): void {
    const defaults = defaultAppConfig();
    recompute({
      config: {
        ...state.config,
        visualization: defaults.visualization,
      },
      focusPath: [],
    });
  },
  canOpenSelected(): boolean {
    const node = selectedNode();
    if (!node || node.nodeType !== "file") {
      return false;
    }
    if (openableWebUrlFromMetadata(node.metadata)) {
      return true;
    }
    const handle = state.handles.get(node.id);
    return Boolean(handle && handle.kind === "file");
  },
  canDownloadSelected(): boolean {
    const node = selectedNode();
    if (!node || node.nodeType !== "file") {
      return false;
    }
    const handle = state.handles.get(node.id);
    return Boolean(handle && handle.kind === "file");
  },
  async openSelected(): Promise<void> {
    const node = selectedNode();
    await actions.openNodeInBrowser(node?.id ?? null);
  },
  async downloadSelected(): Promise<void> {
    const node = selectedNode();
    await actions.downloadNode(node?.id ?? null);
  },
  async openNode(id: string | null): Promise<void> {
    await actions.openNodeInBrowser(id);
  },
  async openNodeInBrowser(id: string | null): Promise<void> {
    if (!id || !state.index) {
      setState({ loadError: "Select a file first." });
      return;
    }
    // FoamTree may pass a viz/group id — resolve to the index file id when needed.
    let node = state.index.items.find((item) => item.id === id) ?? null;
    if (!node || node.nodeType !== "file") {
      const fromTree = state.vizTree ? findFileSourceId(state.vizTree, id) : null;
      if (fromTree) {
        node = state.index.items.find((item) => item.id === fromTree) ?? null;
      }
    }
    if (!node || node.nodeType !== "file") {
      setState({ loadError: "Select a file tile, then open (or double-click it)." });
      return;
    }
    const cloudUrl = openableWebUrlFromMetadata(node.metadata);
    if (cloudUrl) {
      try {
        openWebUrl(cloudUrl);
        clearLoadError();
      } catch (error) {
        setState({
          loadError: error instanceof Error ? error.message : "Could not open the file on the web",
        });
      }
      return;
    }
    let handle: FileSystemFileHandle;
    try {
      const resolved = await localFileHandle(node, true);
      if (resolved === "stale" || resolved === "cancelled") {
        if (resolved === "cancelled") {
          setState({ loadError: "Folder selection cancelled." });
        }
        return;
      }
      if (resolved === "missing") {
        setState({
          loadError: `Cannot find “${node.name}” in “${state.index?.root.name ?? "the selected folder"}”. Pick the same folder this JSON was scanned from (${state.index?.root.name ?? node.name}).`,
        });
        return;
      }
      handle = resolved;
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Could not link the original folder",
      });
      return;
    }
    try {
      const parent = node.parentId ? state.handles.get(node.parentId) : null;
      const startIn = parent?.kind === "directory" ? (parent as FileSystemDirectoryHandle) : undefined;
      const result = await openLocalFileHandle(handle, { startIn });
      setState({
        loadError: null,
        acc: {
          ...state.acc,
          resolveMessage:
            result === "saved"
              ? `Saved ${node.name} — open it from that location in Revit/CAD.`
              : `Downloaded ${node.name} — open it from your Downloads folder.`,
        },
      });
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Could not open the selected file",
      });
    }
  },
  async downloadNode(id: string | null): Promise<void> {
    await actions.openNodeInBrowser(id);
  },
  setSelectedAccUrl(url: string): void {
    const node = selectedNode();
    if (!node || node.nodeType !== "file" || !state.index) {
      setState({ loadError: "Select a file first." });
      return;
    }
    const trimmed = url.trim();
    if (trimmed.length === 0) {
      const nextMeta = { ...(node.metadata ?? {}) };
      delete nextMeta.accUrl;
      patchNodeMetadata(node.id, Object.keys(nextMeta).length > 0 ? nextMeta : undefined);
      clearLoadError();
      return;
    }
    const normalized = normalizeAccWebUrl(trimmed);
    if (!normalized) {
      setState({ loadError: describeAccLinkError(trimmed) });
      return;
    }
    patchNodeMetadata(node.id, { ...(node.metadata ?? {}), accUrl: normalized });
    clearLoadError();
  },
  async copySelectedPath(): Promise<void> {
    const node = selectedNode();
    if (!node) {
      setState({ loadError: "Select a file or folder first." });
      return;
    }
    try {
      await copyText(node.path);
      clearLoadError();
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Could not copy path",
      });
    }
  },
  saveAccSettings(settings: AccSettings): void {
    saveAccSettings(settings);
    setState({
      acc: {
        ...state.acc,
        settings: loadAccSettings(),
      },
    });
    if (state.index) {
      recompute({ index: state.index });
    }
  },
  async signInAcc(): Promise<void> {
    try {
      await beginAccLogin(state.acc.settings.clientId, state.acc.settings.clientSecret);
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Could not start ACC sign-in",
      });
    }
  },
  signOutAcc(): void {
    clearAccToken();
    setState({
      acc: {
        ...state.acc,
        signedIn: false,
        resolveMessage: null,
      },
    });
  },
  async completeAccOAuth(): Promise<void> {
    try {
      const completed = await completeAccLoginFromUrl();
      if (completed) {
        setState({
          acc: {
            ...state.acc,
            signedIn: true,
          },
          loadError: null,
        });
        if (state.index) {
          recompute({ index: state.index });
        }
      } else {
        setState({
          acc: {
            ...state.acc,
            signedIn: isAccSignedIn(),
          },
        });
      }
    } catch (error) {
      setState({
        acc: {
          ...state.acc,
          signedIn: false,
        },
        loadError: error instanceof Error ? error.message : "ACC sign-in failed",
      });
    }
  },
  async resolveAccLinks(): Promise<void> {
    if (!state.index) {
      setState({ loadError: "Load an ACC folder first." });
      return;
    }
    const projectId = state.acc.settings.projectId.trim();
    if (!projectId) {
      setState({
        loadError:
          "Set ACC Project ID in Settings (from any ACC Docs URL: /docs/files/projects/<project-id>).",
      });
      return;
    }
    if (!isAccSignedIn()) {
      setState({ loadError: "Sign in to ACC in Settings before resolving links." });
      return;
    }
    setState({
      acc: {
        ...state.acc,
        resolving: true,
        resolveMessage: "Resolving ACC Docs links…",
      },
      loadError: null,
    });
    try {
      const result = await enrichIndexWithAccLinks(state.index, projectId, (progress) => {
        setState({
          acc: {
            ...state.acc,
            resolving: true,
            resolveMessage: progress.message,
          },
        });
      });
      const note = result.metadataNote ? ` ${result.metadataNote}` : "";
      const names = result.attributeNames.length > 0 ? ` Group by: ${result.attributeNames.join(", ")}.` : "";
      const byName = result.nameMatched > 0 ? ` ${result.nameMatched} matched by file name.` : "";
      const ambiguous = result.ambiguous > 0 ? ` ${result.ambiguous} names exist in more than one ACC folder.` : "";
      let savedLocally = "";
      try {
        const savedCount = await saveAccAttributeCache(projectId, result.index);
        savedLocally =
          savedCount > 0
            ? ` Saved as the default for “${result.index.root.name}” and this project.`
            : ` No ACC attributes were saved for “${result.index.root.name}”.`;
      } catch (error) {
        savedLocally = ` ${error instanceof Error ? error.message : "Could not save ACC attributes on this computer."}`;
      }
      downloadText(
        `${result.index.root.name}.acc-metadata.json`,
        accMetadataDocument(result.index, { error: result.metadataNote, attributes: result.attributeNames }),
      );
      recompute({
        index: result.index,
        acc: {
          ...state.acc,
          resolving: false,
          resolveMessage: `ACC links: ${result.resolved} resolved, ${result.missing} missing. Metadata on ${result.metadataAttached} files.${byName}${ambiguous}${names}${note}${savedLocally}`,
          signedIn: true,
        },
      });
    } catch (error) {
      setState({
        acc: {
          ...state.acc,
          resolving: false,
          resolveMessage: null,
        },
        loadError: error instanceof Error ? error.message : "Could not resolve ACC links",
      });
    }
  },
  saveSharePointSettings(settings: SharePointSettings): void {
    saveSharePointSettings(settings);
    setState({
      sharePoint: {
        ...state.sharePoint,
        settings: loadSharePointSettings(),
      },
    });
  },
  async signInSharePoint(): Promise<void> {
    try {
      await beginSharePointLogin(state.sharePoint.settings.clientId);
    } catch (error) {
      setState({
        loadError: error instanceof Error ? error.message : "Could not start Microsoft sign-in",
      });
    }
  },
  signOutSharePoint(): void {
    clearSharePointToken();
    setState({
      sharePoint: {
        ...state.sharePoint,
        signedIn: false,
        message: null,
      },
    });
  },
  async completeSharePointOAuth(): Promise<void> {
    try {
      const completed = await completeSharePointLoginFromUrl();
      if (completed) {
        setState({
          sharePoint: {
            ...state.sharePoint,
            signedIn: true,
            message: "Signed in to Microsoft. Open Browse SharePoint to import a library.",
          },
          panels: { ...state.panels, sharePointBrowser: true, settings: true, preview: false },
          loadError: null,
        });
      } else {
        setState({
          sharePoint: {
            ...state.sharePoint,
            signedIn: isSharePointSignedIn(),
          },
        });
      }
    } catch (error) {
      setState({
        sharePoint: {
          ...state.sharePoint,
          signedIn: false,
        },
        loadError: error instanceof Error ? error.message : "Microsoft sign-in failed",
      });
    }
  },
  async listSharePointSites(): Promise<GraphSite[]> {
    return listAccessibleSites();
  },
  async listSharePointDrives(siteId: string): Promise<GraphDrive[]> {
    return listSiteDrives(siteId);
  },
  cancelSharePointImport(): void {
    sharePointImportCancel = true;
  },
  async importSharePointDrive(site: GraphSite, drive: GraphDrive, merge: boolean): Promise<void> {
    if (!isSharePointSignedIn()) {
      setState({ loadError: "Sign in to Microsoft in Settings → SharePoint first." });
      return;
    }
    sharePointImportCancel = false;
    setState({
      sharePoint: {
        ...state.sharePoint,
        importing: true,
        message: `Importing “${drive.name}”…`,
      },
      scanning: true,
      scan: {
        phase: "scanning",
        currentPath: drive.name,
        filesScanned: 0,
        foldersScanned: 0,
        totalSize: 0,
        errors: 0,
        elapsedMs: 0,
      },
      loadError: null,
    });
    const startedAt = performance.now();
    try {
      const result = await buildSharePointIndex(site, drive, {
        isCancelled: () => sharePointImportCancel,
        onProgress: (progress) => {
          setState({
            sharePoint: {
              ...state.sharePoint,
              importing: true,
              message: `Importing “${drive.name}” · ${progress.files} files · ${progress.folders} folders`,
            },
            scanning: true,
            scan: {
              phase: "scanning",
              currentPath: progress.currentPath,
              filesScanned: progress.files,
              foldersScanned: progress.folders,
              totalSize: 0,
              errors: 0,
              elapsedMs: performance.now() - startedAt,
            },
          });
        },
      });

      if (!state.index || !merge) {
        recompute({
          index: result.index,
          handles: new Map(),
          scanning: false,
          scan: null,
          selectedId: null,
          focusPath: [],
          loadError: null,
          sharePoint: {
            ...state.sharePoint,
            importing: false,
            message: `Imported “${result.drive.name}” · ${result.index.statistics.totalFiles} files`,
            signedIn: true,
          },
          panels: { ...state.panels, sharePointBrowser: false },
        });
        return;
      }

      const merged = mergeFileIndexes(state.index, state.handles, result.index, new Map(), result.drive.name);
      recompute({
        index: merged.index,
        handles: merged.handles,
        scanning: false,
        scan: null,
        selectedId: null,
        focusPath: [],
        loadError: null,
        sharePoint: {
          ...state.sharePoint,
          importing: false,
          message: `Merged “${merged.batchName}” · ${merged.index.statistics.totalFiles} files total`,
          signedIn: true,
        },
        panels: { ...state.panels, sharePointBrowser: false },
      });
    } catch (error) {
      setState({
        sharePoint: {
          ...state.sharePoint,
          importing: false,
          message: null,
        },
        scanning: false,
        scan: null,
        loadError: error instanceof Error ? error.message : "SharePoint import failed",
      });
    }
  },
  async importSharePointFromUrl(libraryUrl: string, merge: boolean): Promise<void> {
    try {
      setState({
        sharePoint: {
          ...state.sharePoint,
          message: "Resolving SharePoint library URL…",
        },
        loadError: null,
      });
      const resolved = await resolveDriveFromLibraryUrl(libraryUrl);
      await actions.importSharePointDrive(resolved.site, resolved.drive, merge);
    } catch (error) {
      setState({
        sharePoint: {
          ...state.sharePoint,
          importing: false,
        },
        scanning: false,
        scan: null,
        loadError: error instanceof Error ? error.message : "Could not resolve SharePoint URL",
      });
    }
  },
};

function preparingScan(path: string): ScanProgress {
  return {
    currentPath: path,
    filesScanned: 0,
    foldersScanned: 0,
    totalSize: 0,
    errors: 0,
    elapsedMs: 0,
    phase: "preparing",
  };
}

function selectedNode(): IndexNode | null {
  if (!state.selectedId || !state.index) {
    return null;
  }
  return state.index.items.find((item) => item.id === state.selectedId) ?? null;
}

function fileNodeById(id: string): IndexNode | null {
  if (!state.index) {
    return null;
  }
  const direct = state.index.items.find((item) => item.id === id) ?? null;
  if (direct?.nodeType === "file") {
    return direct;
  }
  if (state.vizTree) {
    const sourceId = findFileSourceId(state.vizTree, id);
    if (sourceId) {
      const fromTree = state.index.items.find((item) => item.id === sourceId) ?? null;
      if (fromTree?.nodeType === "file") {
        return fromTree;
      }
    }
  }
  return null;
}

async function localFileHandle(
  node: IndexNode,
  pick: boolean,
): Promise<FileSystemFileHandle | "missing" | "cancelled" | "stale"> {
  const existing = state.handles.get(node.id);
  if (existing?.kind === "file") {
    return existing as FileSystemFileHandle;
  }
  const index = state.index;
  if (!index) {
    return "missing";
  }
  let folder = await permittedLinkedDirectory(index);
  let located = folder ? await resolveFileInFolder(folder, node, index.root.name) : null;
  if (!located) {
    if (!pick) {
      return "missing";
    }
    try {
      linkedDirectory = null;
      folder = await pickOriginalFolder(index);
    } catch (error) {
      if (error instanceof Error && error.message === "Folder selection cancelled.") {
        return "cancelled";
      }
      throw error;
    }
    located = await resolveFileInFolder(folder, node, index.root.name);
  }
  if (state.index !== index) {
    return "stale";
  }
  if (!located || !folder) {
    return "missing";
  }
  rememberDirectory(index, located.directory);
  const nextHandles = new Map(state.handles);
  nextHandles.set(node.id, located.file);
  if (node.parentId) {
    nextHandles.set(node.parentId, located.parent);
  }
  setState({ handles: nextHandles, loadError: null });
  return located.file;
}

function findFileSourceId(node: VizNode, id: string): string | null {
  if (node.id === id || node.sourceId === id) {
    return node.nodeType === "file" ? node.sourceId ?? node.id : null;
  }
  for (const child of node.children) {
    const found = findFileSourceId(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

function clearLoadError(): void {
  if (state.loadError) {
    setState({ loadError: null });
  }
}

function patchNodeMetadata(id: string, metadata: Record<string, unknown> | undefined): void {
  if (!state.index) {
    return;
  }
  const items = state.index.items.map((item) => {
    if (item.id !== id) {
      return item;
    }
    if (metadata === undefined) {
      const { metadata: _removed, ...rest } = item;
      void _removed;
      return rest;
    }
    return { ...item, metadata };
  });
  recompute({
    index: {
      ...state.index,
      items,
    },
  });
}

function applyWorkspace(workspace: WorkspaceFile): void {
  document.documentElement.dataset.theme = workspace.config.theme;
  recompute({
    search: workspace.search,
    selectedId: workspace.selectedId,
    focusPath: workspace.focusPath,
    filters: workspace.filters,
    config: workspace.config,
    panels: { ...state.panels, filters: workspace.panels.filters, details: workspace.panels.details },
  });
}

async function pickTextFile(types: Array<{ description?: string; accept: Record<string, string[]> }>): Promise<string | null> {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({ types });
    const file = await handle.getFile();
    return file.text();
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      resolve(file ? file.text() : null);
    });
    input.click();
  });
}

async function importAccMetadataFiles(handles: HandleMap, folderName: string): Promise<void> {
  for (const handle of handles.values()) {
    if (handle.kind !== "file" || !handle.name.toLowerCase().endsWith(".acc-metadata.json")) {
      continue;
    }
    try {
      const file = await (handle as FileSystemFileHandle).getFile();
      rememberAccMetadataDocument(JSON.parse(await file.text()) as unknown, folderName, new Date(file.lastModified).toISOString());
    } catch {
      // A copy that cannot be read stays out of the default.
    }
  }
}

document.documentElement.dataset.theme = state.config.theme;
installSavedAccMetadataDefaults();
void loadAccAttributeCache()
  .then(() => {
    if (state.index) {
      recompute({ index: state.index });
    }
  })
  .catch(() => undefined);
