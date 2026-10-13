import { actions, usePrisma } from "@/state/store";
import { focusSidebarSearch } from "@/ui/layout/sidebarSearch";
import { resetFoamTreeView } from "@/visualization/foamtree/host";
import { useEffect } from "react";

export function useKeyboard(): void {
  const { panels, selectedId } = usePrisma();

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        actions.setPanel("commandPalette", !panels.commandPalette);
        return;
      }
      if (meta && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void actions.openJson();
        return;
      }
      if (meta && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void actions.openFolder();
        return;
      }
      if (meta && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!panels.filters) {
          actions.togglePanel("filters");
        }
        focusSidebarSearch();
        return;
      }
      if (meta && event.key.toLowerCase() === "r") {
        event.preventDefault();
        void actions.openFolder();
        return;
      }
      if (event.key === "Escape") {
        if (panels.commandPalette) {
          actions.setPanel("commandPalette", false);
          return;
        }
        if (panels.analysis) {
          actions.setPanel("analysis", false);
          return;
        }
        if (panels.preview) {
          actions.setPanel("preview", false);
          return;
        }
        if (panels.settings) {
          actions.setPanel("settings", false);
          return;
        }
        if (selectedId) {
          actions.select(null);
          resetFoamTreeView();
          return;
        }
        resetFoamTreeView();
        actions.navigateBack();
        return;
      }
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        if (selectedId) {
          event.preventDefault();
          void actions.openSelected();
        }
        return;
      }
      if (event.key === "Backspace") {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        event.preventDefault();
        actions.navigateBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panels, selectedId]);
}
