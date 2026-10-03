import { ACC_METADATA_KEYS, presentAccValue } from "@/metadata/accTaxonomy";
import { actions, usePrisma } from "@/state/store";
import { openableWebUrlFromMetadata } from "@/utils/webLinks";
import { formatBytes, formatDate, formatNumber } from "@/utils/format";
import { findVizNode } from "@/visualization/tree";

function daysAgo(value: string | null): string {
  if (!value) {
    return "—";
  }
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) {
    return "—";
  }
  return String(Math.max(0, Math.round((Date.now() - then) / 86_400_000)));
}

function formatMetadataLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetadataValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (typeof value === "string") {
    if (value.trim().length === 0) {
      return "—";
    }
    if ((ACC_METADATA_KEYS as readonly string[]).includes(key)) {
      return presentAccValue(key, value);
    }
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function DetailsPanel(): JSX.Element {
  const { selectedId, index, vizTree, handles } = usePrisma();
  const node = selectedId ? index?.items.find((item) => item.id === selectedId) ?? null : null;
  const group = !node && selectedId && vizTree ? findVizNode(vizTree, selectedId) : null;
  const hasCloudUrl = Boolean(node?.nodeType === "file" && openableWebUrlFromMetadata(node.metadata));
  const canDownload = Boolean(node?.nodeType === "file" && handles.get(node.id)?.kind === "file");
  const canOpen = node?.nodeType === "file";

  return (
    <div className="card">
      <h3>
        Selection
        <button className="reset-link" type="button" onClick={() => actions.select(null)}>
          clear
        </button>
      </h3>
      {node?.nodeType === "file" ? (
        <>
          <div className="detail-title">{node.name}</div>
          <div className="detail-path">{node.path}</div>
          <div className="detail-actions">
            <button
              className="primary"
              type="button"
              disabled={!canOpen}
              title={
                hasCloudUrl
                  ? "Open on the web (Enter or double-click)"
                  : canDownload
                    ? "Double-click the tile or press open to get a local copy"
                    : "Pick the original folder this JSON was scanned from, then save a local copy"
              }
              onClick={() => void actions.openSelected()}
            >
              open
            </button>
          </div>
          <div className="stat-line">
            <span className="k">Size</span>
            <span className="v">{formatBytes(node.size)}</span>
          </div>
          <div className="stat-line">
            <span className="k">Type</span>
            <span className="v">{node.extension ?? "no extension"}</span>
          </div>
          <div className="stat-line">
            <span className="k">Modified</span>
            <span className="v">{formatDate(node.modifiedAt)}</span>
          </div>
          <div className="stat-line">
            <span className="k">Age</span>
            <span className="v">{daysAgo(node.modifiedAt)} days</span>
          </div>
          {node.metadata && Object.keys(node.metadata).length > 0 ? (
            <>
              <div className="detail-section">Document metadata</div>
              {Object.entries(node.metadata).map(([key, value]) => (
                <div className="stat-line" key={key}>
                  <span className="k" title={key}>
                    {formatMetadataLabel(key)}
                  </span>
                  <span className="v" title={formatMetadataValue(key, value)}>
                    {formatMetadataValue(key, value)}
                  </span>
                </div>
              ))}
            </>
          ) : null}
        </>
      ) : node || group ? (
        <>
          <div className="detail-title">{node?.name ?? group?.label}</div>
          <div className="stat-line">
            <span className="k">Files</span>
            <span className="v">{formatNumber(node?.stats?.fileCount ?? group?.fileCount ?? 0)}</span>
          </div>
          <div className="stat-line">
            <span className="k">Total size</span>
            <span className="v">{formatBytes(node?.stats?.totalSize ?? node?.size ?? group?.size ?? 0)}</span>
          </div>
        </>
      ) : (
        <div className="detail-empty">
          Click any tile in the map to see its details. Use open to view in ACC when linked, or get a local copy when not.
        </div>
      )}
    </div>
  );
}
