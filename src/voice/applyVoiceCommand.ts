import { createPrismaApi } from "@/api/prismaApi";
import { clickCell, goBack, openCell, resetView, selectEveryCell } from "@/api/prismaMap";
import { emptyFilterState } from "@/filtering/FilterEngine";
import { actions, getState } from "@/state/store";
import type { VoiceCommand } from "@/voice/parseVoiceUtterance";
import { resolveFilter } from "@/voice/resolveFilter";

const api = createPrismaApi();

/** Run one command that was spoken after "Prisma". Returns the status line. */
export function applyVoiceCommand(command: VoiceCommand): string {
  switch (command.type) {
    case "wake":
      return "Listening";
    case "sleep":
      return "Asleep. Say Prisma.";
    case "back":
      return goBack();
    case "reset":
      actions.clearSemanticHits();
      resetView();
      return "View reset";
    case "selectAll": {
      const result = selectEveryCell();
      return result.ok ? "Selected every cell" : result.message;
    }
    case "select":
      return selectNamed(command.name);
    case "filterClear":
      actions.clearFilters();
      showFilters();
      return "Filters cleared";
    case "filterPanel":
      showFilters();
      return "Filters";
    case "filter":
      return applyFilter(command.query);
    case "ask":
      return runAsk(command.text);
    default:
      return "";
  }
}

function runAsk(text: string): string {
  if (!getState().index) {
    return "Load a map first";
  }
  const result = api.ask(text);
  if (result.hits.length === 0) {
    return `No match for “${text}”`;
  }
  if (result.hits.length === 1) {
    return `Showing ${result.hits[0].node.name}`;
  }
  return `Showing ${result.hits.length} on the map`;
}

function showFilters(): void {
  if (!getState().panels.filters) {
    actions.togglePanel("filters");
  }
}

function applyFilter(query: string): string {
  const resolved = resolveFilter(query);
  if (resolved.search) {
    actions.setSearch(resolved.search);
    showFilters();
    return `Showing “${resolved.label}”`;
  }
  actions.setSearch("");
  actions.setFilters({
    ...emptyFilterState(),
    categories: resolved.categories,
    extensions: resolved.extensions,
  });
  showFilters();
  return `Filter ${resolved.label}`;
}

function selectNamed(name: string): string {
  const opened = openCell(name);
  if (opened.ok) {
    return `Opened ${opened.label}`;
  }
  const clicked = clickCell(name);
  if (clicked.ok) {
    return `Selected ${clicked.label}`;
  }
  if (!getState().vizTree) {
    return "Load a map first";
  }
  return opened.message;
}
