import { builtinPresets } from "@/config/presets";
import { toggleGestures, useGestureStatus } from "@/gestures/gestureCamera";
import { toggleVoice, useVoiceState } from "@/voice/voiceListener";
import { actions, usePrisma } from "@/state/store";
import { Breadcrumbs } from "@/ui/visualization/Breadcrumbs";
import { useRef } from "react";

export function Toolbar({ onMenuIndex }: { onMenuIndex: (index: number | null) => void }): JSX.Element {
  const { config, panels } = usePrisma();
  const gesture = useGestureStatus();
  const voice = useVoiceState();
  const moreRef = useRef<HTMLDetailsElement>(null);

  function runMore(action: () => void): void {
    moreRef.current?.removeAttribute("open");
    action();
  }

  function tabProps(index: number): { onMouseEnter: () => void; onFocus: () => void } {
    return {
      onMouseEnter: () => onMenuIndex(index),
      onFocus: () => onMenuIndex(index),
    };
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="mark">
          <span>Prisma</span>
        </div>
        <Breadcrumbs />
      </div>
      <div className="topbar-menu" onMouseLeave={() => onMenuIndex(null)}>
        <div className="topbar-menu-items">
        <button type="button" className="menu-item" title="Load a synthetic sample project" {...tabProps(0)} onClick={() => actions.loadSample()}>
          Sample data
        </button>
        <button type="button" className="menu-item" title="Choose a real folder from your computer" {...tabProps(1)} onClick={() => void actions.openFolder()}>
          Load folder
        </button>
        <button
          type="button"
          className="menu-item"
          title="Add another ACC or local folder into the current map"
          {...tabProps(2)}
          onClick={() => void actions.mergeFolder()}
        >
          Merge folder
        </button>
        <button
          type="button"
          className={panels.analysis ? "menu-item is-on" : "menu-item"}
          title="Charts for the open folder"
          aria-pressed={panels.analysis}
          {...tabProps(3)}
          onClick={() => actions.setPanel("analysis", !panels.analysis)}
        >
          Analysis
        </button>
        <button
          type="button"
          className={panels.preview ? "menu-item is-on" : "menu-item"}
          title="Preview the selected file"
          aria-pressed={panels.preview}
          {...tabProps(4)}
          onClick={() => actions.setPanel("preview", !panels.preview)}
        >
          Preview
        </button>
        <button
          type="button"
          className={panels.settings ? "menu-item is-on" : "menu-item"}
          title="FoamTree settings"
          aria-pressed={panels.settings}
          {...tabProps(5)}
          onClick={() => actions.setPanel("settings", !panels.settings)}
        >
          Settings
        </button>
        <button
          type="button"
          className={gesture === "on" || gesture === "loading" ? "menu-item is-on" : "menu-item"}
          title="Camera hand gestures: pinch to select, thumbs to zoom, palm to go back"
          aria-pressed={gesture === "on"}
          {...tabProps(7)}
          onClick={() => toggleGestures()}
        >
          Camera
        </button>
        <button
          type="button"
          className={voice.status === "on" ? "menu-item is-on" : "menu-item"}
          title="Voice commands. Say Prisma down to pause, Prisma to resume"
          aria-pressed={voice.status === "on"}
          {...tabProps(8)}
          onClick={() => toggleVoice()}
        >
          Voice
        </button>
        <details className="more-menu menu-item" ref={moreRef} {...tabProps(6)}>
          <summary>
            <span>More</span>
          </summary>
          <div className="more-pop">
            <button type="button" onClick={() => runMore(() => void actions.openJson())}>
              Open JSON
            </button>
            <button type="button" onClick={() => runMore(() => void actions.mergeJson())}>
              Merge JSON
            </button>
            <button type="button" onClick={() => runMore(() => void actions.mergeFolder())}>
              Merge folder
            </button>
            <button type="button" onClick={() => runMore(() => actions.setPanel("sharePointBrowser", true))}>
              Browse SharePoint
            </button>
            <button type="button" onClick={() => runMore(() => void actions.resolveAccLinks())}>
              Resolve ACC links
            </button>
            <button type="button" onClick={() => runMore(() => actions.exportJson())}>
              Export JSON
            </button>
            <button type="button" onClick={() => runMore(() => actions.exportCsv())}>
              Export CSV
            </button>
            <button type="button" onClick={() => runMore(() => actions.exportWorkspace())}>
              Save workspace
            </button>
            {builtinPresets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => runMore(() => actions.applyPreset(preset))}>
                {preset.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => runMore(() => actions.setTheme(config.theme === "dark" ? "light" : "dark"))}
            >
              {config.theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <button type="button" onClick={() => runMore(() => actions.togglePanel("filters"))}>
              Toggle sidebar
            </button>
            <button type="button" onClick={() => runMore(() => actions.setPanel("commandPalette", true))}>
              Commands
            </button>
          </div>
        </details>
        </div>
      </div>
    </header>
  );
}
