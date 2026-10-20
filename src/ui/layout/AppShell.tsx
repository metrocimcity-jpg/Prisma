import { CommandPalette } from "@/ui/dialogs/CommandPalette";
import { ScanProgressDialog } from "@/ui/dialogs/ScanProgress";
import { SettingsDialog } from "@/ui/dialogs/SettingsDialog";
import { SharePointBrowserDialog } from "@/ui/dialogs/SharePointBrowserDialog";
import { EmptyState } from "@/ui/empty/EmptyState";
import { useKeyboard } from "@/ui/hooks/useKeyboard";
import { AnalysisSchedule } from "@/ui/layout/AnalysisSchedule";
import { PreviewPanel } from "@/ui/layout/PreviewPanel";
import { Sidebar } from "@/ui/layout/Sidebar";
import { StatusBar } from "@/ui/layout/StatusBar";
import { Toolbar } from "@/ui/layout/Toolbar";
import { VizStage } from "@/ui/visualization/VizStage";
import { usePrisma } from "@/state/store";
import { useState } from "react";

function stageTone(background: string): "stage-dark" | "stage-light" {
  const hex = background.trim();
  if (hex.startsWith("#") && (hex.length === 7 || hex.length === 4)) {
    const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    const n = Number.parseInt(full.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.45 ? "stage-dark" : "stage-light";
  }
  return "stage-dark";
}

export function AppShell(): JSX.Element {
  const { index, panels, config } = usePrisma();
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  useKeyboard();
  const background = config.visualization.style.stageBackground;
  const tone = stageTone(background);
  const showMap = Boolean(index) && !panels.analysis;

  return (
    <div className="app-shell">
      <div
        className="app-backdrop"
        data-active-index={menuIndex ?? undefined}
        data-hot={menuIndex === null ? undefined : ""}
      >
        <div className="app-backdrop-pattern" />
        <div className="app-backdrop-image">
          <video className="app-backdrop-video" src="/1.mp4" autoPlay muted loop playsInline />
        </div>
      </div>
      <Toolbar onMenuIndex={setMenuIndex} />
      <div className="layout">
        {panels.filters ? <Sidebar /> : null}
        <main className={`stage ${tone}`} style={{ background: showMap ? background : "transparent" }}>
          {panels.analysis ? <AnalysisSchedule /> : index ? <VizStage /> : <EmptyState />}
        </main>
        {panels.preview ? <PreviewPanel /> : null}
        {panels.settings ? <SettingsDialog /> : null}
      </div>
      <StatusBar />
      <CommandPalette />
      <SharePointBrowserDialog />
      <ScanProgressDialog />
    </div>
  );
}
