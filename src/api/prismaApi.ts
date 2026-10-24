import { clickCell, goBack, openCell, resetView, selectEveryCell, zoom } from "@/api/prismaMap";
import type { FileIndex, IndexNode } from "@/data/types";
import { CATEGORY_GROUPS } from "@/filtering/categoryGroups";
import { emptyFilterState, type FilterState } from "@/filtering/FilterEngine";
import { resolveFilter } from "@/voice/resolveFilter";
import { defaultSearchEngine, type SearchHit } from "@/search/SearchEngine";
import {
  intentToSearchQuery,
  searchSemanticMany,
  splitSemanticAsks,
  type SemanticHit,
  type SemanticSearchResult,
} from "@/search/semanticSearch";
import { parseSemanticIntent, type SemanticIntent } from "@/search/semanticIntent";
import { enrichIntentWithIndexMetadata } from "@/search/semanticMetadata";
import { actions, getState, subscribe, type PrismaState } from "@/state/store";
import type { AppConfig, SavedPreset } from "@/config/defaults";
import type { GroupLevel } from "@/visualization/types";
import { getFoamTreeInstance } from "@/visualization/foamtree/host";
import { toggleGestures, getGestureState, stopGestures, type GestureStatus } from "@/gestures/gestureCamera";
import { toggleVoice, getVoiceState, stopVoice, startVoice } from "@/voice/voiceListener";

export interface PrismaAskResult extends SemanticSearchResult {
  /** Classic field search applied to the map from the same ask. */
  appliedSearch: string;
  /** Individual asks when the input used `/` multi-search. */
  parts: string[];
}

export interface PrismaAskState {
  ask: string;
  hitIds: string[];
  hits: IndexNode[];
}

export interface PrismaApi {
  // —— State ——
  getIndex: () => FileIndex | null;
  getState: () => PrismaState;
  subscribe: (listener: () => void) => () => void;
  getSelected: () => IndexNode | null;
  getHovered: () => IndexNode | null;
  listFiles: () => IndexNode[];
  listVisible: () => IndexNode[];
  findFile: (nameOrPathOrId: string) => IndexNode | null;

  // —— Load / export ——
  loadSample: () => void;
  loadIndex: (index: FileIndex) => void;
  openFolder: () => Promise<void>;
  openJson: () => Promise<void>;
  mergeFolder: () => Promise<void>;
  mergeJson: () => Promise<void>;
  exportJson: () => void;
  exportCsv: () => void;
  exportWorkspace: () => void;
  cancelScan: () => void;

  // —— Search ——
  search: (query: string) => SearchHit[];
  clearSearch: () => void;

  // —— Ask Prisma (semantic) ——
  /** Rank + pin hits on a temporary FoamTree (supports multi-ask with `/`). */
  ask: (text: string) => PrismaAskResult;
  /** Same as ask, but join several phrases with `/` first. */
  askMany: (parts: string[]) => PrismaAskResult;
  /** Rank without changing the map. */
  previewAsk: (text: string) => SemanticSearchResult;
  /** Parse NL intent (with index metadata enrichment when an index is loaded). */
  parseAsk: (text: string) => SemanticIntent;
  /** Split a multi-ask string on `/`, `|`, `;`, or newlines. */
  splitAsk: (text: string) => string[];
  getFavorite: (text: string) => IndexNode | null;
  /** Current Ask Prisma pin on the map (empty when cleared). */
  getAsk: () => PrismaAskState;
  listAskHits: () => IndexNode[];
  /** Leave Ask Prisma and restore the map from before the ask. */
  clearAsk: () => void;
  /** Pin arbitrary file ids as Ask results (adjacent FoamTree siblings). */
  pinAskHits: (ask: string, hitIds: string[]) => void;

  // —— Filters ——
  setFilters: (filters: FilterState) => void;
  patchFilters: (patch: Partial<FilterState>) => void;
  clearFilters: () => void;
  filterCategory: (category: string) => FilterState;
  filterExtension: (extension: string) => FilterState;
  filterCategories: (categories: string[]) => FilterState;
  filterByQuery: (query: string) => FilterState;
  emptyFilters: () => FilterState;

  // —— Map / cells (click, open, back, reset) ——
  click: (nameOrId: string) => ReturnType<typeof clickCell>;
  select: (id: string | null) => void;
  selectByName: (name: string) => ReturnType<typeof clickCell>;
  selectAll: () => ReturnType<typeof selectEveryCell>;
  open: (nameOrId?: string | null) => Promise<ReturnType<typeof openCell> | { ok: true; id: string | null }>;
  openSelected: () => Promise<void>;
  doubleClick: (nameOrId: string) => ReturnType<typeof openCell>;
  hover: (id: string | null) => void;
  back: () => string;
  reset: () => void;
  drillInto: (vizId: string) => void;
  setFocusPath: (path: string[]) => void;
  zoomIn: (steps?: number) => boolean;
  zoomOut: (steps?: number) => boolean;
  getFoamTree: () => ReturnType<typeof getFoamTreeInstance>;

  // —— Panels / chrome ——
  showFilters: () => void;
  hideFilters: () => void;
  toggleFilters: () => void;
  showPreview: () => void;
  hidePreview: () => void;
  showAnalysis: () => void;
  hideAnalysis: () => void;
  showSettings: () => void;
  hideSettings: () => void;
  showCommands: () => void;
  setPanel: (panel: "settings" | "preview" | "analysis" | "commandPalette" | "sharePointBrowser", open: boolean) => void;

  // —— View config ——
  setTheme: (theme: AppConfig["theme"]) => void;
  setGroupBy: (groupBy: GroupLevel[]) => void;
  setColorBy: (colorBy: AppConfig["visualization"]["colorBy"]) => void;
  patchVisualization: (patch: Parameters<typeof actions.patchVisualization>[0]) => void;
  patchStyle: (patch: Parameters<typeof actions.patchStyle>[0]) => void;
  applyPreset: (preset: SavedPreset) => void;
  applyStylePreset: (id: string) => void;
  resetVisualization: () => void;

  // —— Hands / voice ——
  startCamera: () => void;
  stopCamera: () => void;
  toggleCamera: () => void;
  cameraStatus: () => GestureStatus;
  startVoice: () => void;
  stopVoice: () => void;
  toggleVoice: () => void;
  voiceStatus: () => ReturnType<typeof getVoiceState>;

  // —— ACC / SharePoint (thin passthrough) ——
  resolveAccLinks: () => Promise<void>;
  signInAcc: () => Promise<void>;
  signOutAcc: () => void;
  openSharePointBrowser: () => void;
}

function nodeById(id: string | null): IndexNode | null {
  const { index } = getState();
  if (!index || !id) {
    return null;
  }
  return index.items.find((item) => item.id === id) ?? null;
}

function selectedNode(): IndexNode | null {
  return nodeById(getState().selectedId);
}

function findFile(nameOrPathOrId: string): IndexNode | null {
  const { index } = getState();
  if (!index) {
    return null;
  }
  const needle = nameOrPathOrId.trim().toLowerCase();
  return (
    index.items.find(
      (item) =>
        item.nodeType === "file" &&
        (item.id === nameOrPathOrId ||
          item.name.toLowerCase() === needle ||
          item.relativePath.toLowerCase() === needle ||
          item.relativePath.toLowerCase().endsWith(`/${needle}`)),
    ) ?? null
  );
}

function applyCategoryFilter(categories: string[]): FilterState {
  const next = {
    ...emptyFilterState(),
    categories,
  };
  actions.setSearch("");
  actions.setFilters(next);
  return next;
}

export function createPrismaApi(): PrismaApi {
  function runAsk(text: string): PrismaAskResult {
    const result = searchSemanticMany(getState().index, text);
    const parts = splitSemanticAsks(text);
    const appliedSearch = parts
      .map((part) => intentToSearchQuery(parseSemanticIntent(part)))
      .filter(Boolean)
      .join(" · ");
    const hitIds = result.hits.map((hit) => hit.id);
    const label = parts.length > 1 ? parts.join(" · ") : text.trim();
    // Temporary FoamTree JSON: hit files as adjacent siblings (do not apply keyword search/filters).
    actions.setSemanticHits(label, hitIds);
    return { ...result, appliedSearch, parts };
  }

  function currentAsk(): PrismaAskState {
    const { index, semanticAsk, semanticHitIds } = getState();
    const hits =
      index === null
        ? []
        : semanticHitIds
            .map((id) => index.items.find((item) => item.id === id))
            .filter((item): item is IndexNode => Boolean(item));
    return { ask: semanticAsk, hitIds: [...semanticHitIds], hits };
  }

  return {
    getIndex: () => getState().index,
    getState,
    subscribe,
    getSelected: selectedNode,
    getHovered: () => nodeById(getState().hoveredId),
    listFiles: () => getState().index?.items.filter((item) => item.nodeType === "file") ?? [],
    listVisible: () => {
      const { index, visibleIds } = getState();
      if (!index) {
        return [];
      }
      return index.items.filter((item) => item.nodeType === "file" && visibleIds.has(item.id));
    },
    findFile,

    loadSample: () => actions.loadSample(),
    loadIndex: (index) => actions.loadIndex(index),
    openFolder: () => actions.openFolder(),
    openJson: () => actions.openJson(),
    mergeFolder: () => actions.mergeFolder(),
    mergeJson: () => actions.mergeJson(),
    exportJson: () => actions.exportJson(),
    exportCsv: () => actions.exportCsv(),
    exportWorkspace: () => actions.exportWorkspace(),
    cancelScan: () => actions.cancelScan(),

    search(query: string): SearchHit[] {
      const index = getState().index;
      if (!index) {
        return [];
      }
      actions.setSearch(query);
      return defaultSearchEngine.search(index.items, query);
    },
    clearSearch(): void {
      actions.setSearch("");
    },
    previewAsk(text: string): SemanticSearchResult {
      return searchSemanticMany(getState().index, text);
    },
    ask: runAsk,
    askMany(parts: string[]): PrismaAskResult {
      const cleaned = parts.map((part) => part.trim()).filter(Boolean);
      return runAsk(cleaned.join(" / "));
    },
    parseAsk(text: string): SemanticIntent {
      const intent = parseSemanticIntent(text);
      const index = getState().index;
      return index ? enrichIntentWithIndexMetadata(intent, index, text) : intent;
    },
    splitAsk: splitSemanticAsks,
    getFavorite(text: string): IndexNode | null {
      return searchSemanticMany(getState().index, text).favorite;
    },
    getAsk: currentAsk,
    listAskHits: () => currentAsk().hits,
    clearAsk(): void {
      actions.clearSemanticHits();
    },
    pinAskHits(ask: string, hitIds: string[]): void {
      actions.setSemanticHits(ask.trim(), hitIds);
    },

    setFilters: (filters) => actions.setFilters(filters),
    patchFilters: (patch) => actions.patchFilters(patch),
    clearFilters: () => actions.clearFilters(),
    emptyFilters: emptyFilterState,
    filterCategory(category: string): FilterState {
      const resolved = resolveFilter(category);
      if (resolved.search) {
        actions.setSearch(resolved.search);
        actions.setFilters(emptyFilterState());
        return emptyFilterState();
      }
      return applyCategoryFilter(resolved.categories.length > 0 ? resolved.categories : [category]);
    },
    filterExtension(extension: string): FilterState {
      const ext = extension.replace(/^\./, "").toLowerCase();
      const next = { ...emptyFilterState(), extensions: [ext] };
      actions.setSearch("");
      actions.setFilters(next);
      return next;
    },
    filterCategories(categories: string[]): FilterState {
      const members = categories.flatMap((label) => {
        const group = CATEGORY_GROUPS.find(
          (item) => item.label.toLowerCase() === label.toLowerCase() || item.id.toLowerCase() === label.toLowerCase(),
        );
        return group ? group.members : [label];
      });
      return applyCategoryFilter([...new Set(members)]);
    },
    filterByQuery(query: string): FilterState {
      const resolved = resolveFilter(query);
      if (resolved.search) {
        actions.setSearch(resolved.search);
        actions.setFilters(emptyFilterState());
        return emptyFilterState();
      }
      const next = {
        ...emptyFilterState(),
        categories: resolved.categories,
        extensions: resolved.extensions,
      };
      actions.setSearch("");
      actions.setFilters(next);
      return next;
    },

    click: clickCell,
    select: (id) => actions.select(id),
    selectByName: clickCell,
    selectAll: selectEveryCell,
    doubleClick: openCell,
    open: async (nameOrId) => {
      if (nameOrId) {
        return openCell(nameOrId);
      }
      await actions.openSelected();
      return { ok: true, id: getState().selectedId };
    },
    openSelected: () => actions.openSelected(),
    hover: (id) => actions.hover(id),
    back: goBack,
    reset: resetView,
    drillInto: (vizId) => actions.drillInto(vizId),
    setFocusPath: (path) => actions.setFocusPath(path),
    zoomIn: (steps = 1) => {
      let ok = false;
      for (let i = 0; i < steps; i += 1) {
        ok = zoom(1) || ok;
      }
      return ok;
    },
    zoomOut: (steps = 1) => {
      let ok = false;
      for (let i = 0; i < steps; i += 1) {
        ok = zoom(-1) || ok;
      }
      return ok;
    },
    getFoamTree: getFoamTreeInstance,

    showFilters: () => {
      if (!getState().panels.filters) {
        actions.togglePanel("filters");
      }
    },
    hideFilters: () => {
      if (getState().panels.filters) {
        actions.togglePanel("filters");
      }
    },
    toggleFilters: () => actions.togglePanel("filters"),
    showPreview: () => actions.setPanel("preview", true),
    hidePreview: () => actions.setPanel("preview", false),
    showAnalysis: () => actions.setPanel("analysis", true),
    hideAnalysis: () => actions.setPanel("analysis", false),
    showSettings: () => actions.setPanel("settings", true),
    hideSettings: () => actions.setPanel("settings", false),
    showCommands: () => actions.setPanel("commandPalette", true),
    setPanel: (panel, open) => actions.setPanel(panel, open),

    setTheme: (theme) => actions.setTheme(theme),
    setGroupBy: (groupBy) => actions.patchVisualization({ groupBy }),
    setColorBy: (colorBy) => actions.patchVisualization({ colorBy }),
    patchVisualization: (patch) => actions.patchVisualization(patch),
    patchStyle: (patch) => actions.patchStyle(patch),
    applyPreset: (preset) => actions.applyPreset(preset),
    applyStylePreset: (id) => actions.applyStylePreset(id),
    resetVisualization: () => actions.resetVisualization(),

    startCamera: () => {
      if (getGestureState().status === "off") {
        toggleGestures();
      }
    },
    stopCamera: () => stopGestures(),
    toggleCamera: () => toggleGestures(),
    cameraStatus: () => getGestureState().status,
    startVoice: () => startVoice(),
    stopVoice: () => stopVoice(),
    toggleVoice: () => toggleVoice(),
    voiceStatus: () => getVoiceState(),

    resolveAccLinks: () => actions.resolveAccLinks(),
    signInAcc: () => actions.signInAcc(),
    signOutAcc: () => actions.signOutAcc(),
    openSharePointBrowser: () => actions.setPanel("sharePointBrowser", true),
  };
}

export type PrismaWindow = Window & { prisma?: PrismaApi };

/** Install `window.prisma` so scripts and the console can drive the original app. */
export function installPrismaApi(target: PrismaWindow = window): PrismaApi {
  const api = createPrismaApi();
  target.prisma = api;
  return api;
}

export type { SemanticHit, SemanticIntent, SearchHit };
export { emptyFilterState, CATEGORY_GROUPS };
