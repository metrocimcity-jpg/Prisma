import { actions, usePrisma } from "@/state/store";
import { formatBytes, formatDuration, formatNumber } from "@/utils/format";

export function ScanProgressDialog(): JSX.Element | null {
  const { scanning, scan } = usePrisma();
  if (!scanning || !scan) {
    return null;
  }
  return (
    <div className="overlay" role="alertdialog" aria-label="Scan progress">
      <div className="dialog">
        <header>
          <strong>Scanning</strong>
          <div className="kicker">{scan.currentPath || "Preparing…"}</div>
        </header>
        <div className="panel-body">
          <div>
            {formatNumber(scan.filesScanned)} files · {formatNumber(scan.foldersScanned)} folders · {formatBytes(scan.totalSize)}
          </div>
          <div>
            {scan.errors} errors · {formatDuration(scan.elapsedMs)}
          </div>
          <button type="button" onClick={() => actions.cancelScan()}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
