import { AccSettingsCard } from "@/ui/dialogs/AccSettingsCard";
import { SharePointSettingsCard } from "@/ui/dialogs/SharePointSettingsCard";
import { SidebarSelect } from "@/ui/layout/SidebarSelect";
import { actions, usePrisma } from "@/state/store";
import { prismaLayoutFromFoam } from "@/visualization/defaultStyle";
import { settingGroups, type SettingControl } from "@/visualization/foamtree/settingsSchema";
import { STYLE_PRESET_GROUPS, stylePresets } from "@/visualization/foamtree/stylePresets";
import { downloadText } from "@/utils/format";
import type { VisualizationStyle } from "@/visualization/types";
import { useMemo, useState } from "react";

function matchesQuery(label: string, option: string, query: string): boolean {
  if (query.trim().length === 0) {
    return true;
  }
  const hay = `${label} ${option}`.toLowerCase();
  return hay.includes(query.trim().toLowerCase());
}

function SettingRow({ control }: { control: SettingControl }): JSX.Element {
  const { config } = usePrisma();
  const style = config.visualization.style;
  const id = `setting-${control.option}`;

  const value =
    control.option === "showLabels"
      ? config.visualization.showLabels
      : control.option === "animation"
        ? config.visualization.animation
        : style[control.option as keyof VisualizationStyle];

  const commit = (next: string | number | boolean): void => {
    if (control.option === "showLabels") {
      actions.patchVisualization({ showLabels: Boolean(next) });
      return;
    }
    if (control.option === "animation") {
      actions.patchVisualization({ animation: Boolean(next) });
      return;
    }
    const key = control.option as keyof VisualizationStyle;
    const stylePatch = { [key]: next } as Partial<VisualizationStyle>;
    if (key === "foamLayout" || key === "stacking" || key === "relaxationInitializer") {
      const merged = { ...style, ...stylePatch };
      actions.patchVisualization({
        layout: prismaLayoutFromFoam(merged),
        style: merged,
      });
      return;
    }
    actions.patchStyle(stylePatch);
  };

  if (control.type === "boolean") {
    return (
      <label className="settings-row settings-boolean" htmlFor={id}>
        <span>{control.label}</span>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => commit(event.target.checked)}
        />
      </label>
    );
  }

  if (control.type === "enum") {
    return (
      <div className="settings-row">
        <label htmlFor={id}>{control.label}</label>
        <SidebarSelect
          id={id}
          value={String(value)}
          options={control.values.map((item) => ({ value: item.value, label: item.label ?? item.value }))}
          onChange={(next) => commit(next)}
        />
      </div>
    );
  }

  if (control.type === "number") {
    const numeric = Number(value);
    return (
      <label className="settings-row" htmlFor={id}>
        <span>{control.label}</span>
        <div className="settings-number">
          <input
            className="settings-number-value"
            id={id}
            type="number"
            min={control.min}
            max={control.max}
            step={control.step}
            value={Number.isFinite(numeric) ? numeric : 0}
            onChange={(event) => commit(Number(event.target.value))}
          />
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={Number.isFinite(numeric) ? numeric : 0}
            onChange={(event) => commit(Number(event.target.value))}
          />
        </div>
      </label>
    );
  }

  return (
    <label className="settings-row" htmlFor={id}>
      <span>{control.label}</span>
      <input id={id} type="text" value={String(value ?? "")} onChange={(event) => commit(event.target.value)} />
    </label>
  );
}

export function SettingsPanel(): JSX.Element | null {
  const { panels, config } = usePrisma();
  const [query, setQuery] = useState("");
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const filteredGroups = useMemo(
    () =>
      settingGroups
        .map((group) => ({
          ...group,
          options: group.options.filter((item) => matchesQuery(item.label, item.option, query)),
        }))
        .filter((group) => group.options.length > 0),
    [query],
  );

  const filteredPresets = useMemo(
    () => stylePresets.filter((preset) => matchesQuery(preset.label, preset.group, query)),
    [query],
  );

  if (!panels.settings) {
    return null;
  }

  const exportJson = (): void => {
    const current = foamTreeExport(config.visualization.style, config.visualization);
    downloadText("foamtree-settings.json", `${JSON.stringify(current, null, 2)}\n`);
  };

  return (
    <aside className="settings-panel" aria-label="FoamTree settings">
      <div className="settings-tools">
        <input
          type="search"
          placeholder="type setting to find, e.g. color or label"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Find setting"
        />
        <button type="button" className="ghost" onClick={() => actions.setPanel("settings", false)}>
          Close
        </button>
      </div>

      <div className="settings-intro">
        <p>Use this panel to tune FoamTree settings. Look in Presets for ready-to-use color and style combinations.</p>
        <p>
          <button type="button" className="reset-link" onClick={exportJson}>
            Export settings to JSON
          </button>
        </p>
      </div>

      <AccSettingsCard />
      <SharePointSettingsCard />

      <section className={folded.presets ? "settings-section folded" : "settings-section"}>
        <header onClick={() => setFolded((prev) => ({ ...prev, presets: !prev.presets }))}>
          <h3>Presets</h3>
          <span className="fold-mark">{folded.presets ? "▸" : "▾"}</span>
        </header>
        <div>
          {STYLE_PRESET_GROUPS.map((group) => {
            const items = filteredPresets.filter((preset) => preset.group === group);
            if (items.length === 0) {
              return null;
            }
            return (
              <div className="preset-group" key={group}>
                <h4>{group}</h4>
                <div className="preset-links">
                  {items.map((preset) => (
                    <button key={preset.id} type="button" title={preset.description} onClick={() => actions.applyStylePreset(preset.id)}>
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {filteredGroups.map((group) => (
        <section
          key={group.id}
          className={folded[group.id] ? "settings-section folded" : "settings-section"}
        >
          <header onClick={() => setFolded((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}>
            <h3>{group.label}</h3>
            <span className="fold-mark">{folded[group.id] ? "▸" : "▾"}</span>
          </header>
          <div>
            {group.options.map((control) => (
              <SettingRow key={control.option} control={control} />
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function foamTreeExport(style: VisualizationStyle, viz: { showLabels: boolean; animation: boolean }): Record<string, unknown> {
  return {
    layout: style.foamLayout,
    stacking: style.stacking,
    layoutByWeightOrder: style.layoutByWeightOrder,
    groupMinDiameter: style.groupMinDiameter,
    relaxationInitializer: style.relaxationInitializer,
    relaxationQualityThreshold: style.relaxationQualityThreshold,
    descriptionGroup: style.descriptionGroup,
    descriptionGroupType: style.descriptionGroupType,
    descriptionGroupSize: style.descriptionGroupSize,
    descriptionGroupMaxHeight: style.descriptionGroupMaxHeight,
    groupBorderRadius: style.groupBorderRadius,
    groupBorderWidth: style.groupBorderWidth,
    groupInsetWidth: style.groupInsetWidth,
    groupFillType: style.groupFillType,
    groupStrokeType: style.groupStrokeType,
    groupStrokeWidth: style.groupStrokeWidth,
    groupLabelFontFamily: style.groupLabelFontFamily,
    groupLabelFontWeight: style.groupLabelFontWeight,
    groupLabelMinFontSize: viz.showLabels ? style.groupLabelMinFontSize : 1000,
    groupLabelMaxFontSize: style.groupLabelMaxFontSize,
    maxGroupLevelsDrawn: style.maxGroupLevelsDrawn,
    maxGroupLabelLevelsDrawn: viz.showLabels ? style.maxGroupLabelLevelsDrawn : 0,
    rainbowStartColor: style.rainbowStartColor,
    rainbowEndColor: style.rainbowEndColor,
    rainbowColorDistribution: style.rainbowColorDistribution,
    rolloutDuration: viz.animation ? style.rolloutDuration : 0,
    pullbackDuration: viz.animation ? style.pullbackDuration : 0,
    fadeDuration: viz.animation ? style.fadeDuration : 0,
  };
}

export { SettingsPanel as SettingsDialog };
