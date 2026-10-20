import { actions, usePrisma } from "@/state/store";
import { SidebarSelect } from "@/ui/layout/SidebarSelect";
import type { GraphDrive, GraphSite } from "@/sharepoint/graph";
import { useEffect, useState } from "react";

export function SharePointBrowserDialog(): JSX.Element | null {
  const { panels, sharePoint, index } = usePrisma();
  const [sites, setSites] = useState<GraphSite[]>([]);
  const [drives, setDrives] = useState<GraphDrive[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const [libraryUrl, setLibraryUrl] = useState("");
  const [loadingSites, setLoadingSites] = useState(false);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!panels.sharePointBrowser) {
      return;
    }
    if (!sharePoint.signedIn) {
      setLocalError("Sign in to Microsoft from Settings → SharePoint first.");
      setSites([]);
      return;
    }
    let cancelled = false;
    setLoadingSites(true);
    setLocalError(null);
    void actions
      .listSharePointSites()
      .then((result) => {
        if (cancelled) {
          return;
        }
        setSites(result);
        if (result.length === 0) {
          setLocalError("No SharePoint sites found. Try pasting a library URL below.");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLocalError(error instanceof Error ? error.message : "Could not list SharePoint sites");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSites(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [panels.sharePointBrowser, sharePoint.signedIn]);

  useEffect(() => {
    if (!selectedSiteId) {
      setDrives([]);
      setSelectedDriveId(null);
      return;
    }
    let cancelled = false;
    setLoadingDrives(true);
    setLocalError(null);
    void actions
      .listSharePointDrives(selectedSiteId)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDrives(result);
        setSelectedDriveId(result[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLocalError(error instanceof Error ? error.message : "Could not list libraries");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingDrives(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSiteId]);

  if (!panels.sharePointBrowser) {
    return null;
  }

  const selectedSite = sites.find((site) => site.id === selectedSiteId) ?? null;
  const selectedDrive = drives.find((drive) => drive.id === selectedDriveId) ?? null;
  const canImport = Boolean(selectedSite && selectedDrive) && !sharePoint.importing;
  const mergeLabel = index ? "Merge library" : "Import library";

  return (
    <div
      className="overlay"
      role="dialog"
      aria-label="Browse SharePoint"
      onClick={() => {
        if (!sharePoint.importing) {
          actions.setPanel("sharePointBrowser", false);
        }
      }}
    >
      <div className="dialog sharepoint-browser" onClick={(event) => event.stopPropagation()}>
        <header>
          <strong>Browse SharePoint</strong>
          <button
            type="button"
            className="ghost"
            disabled={sharePoint.importing}
            onClick={() => actions.setPanel("sharePointBrowser", false)}
          >
            Close
          </button>
        </header>
        <div className="panel-body">
          <p className="detail-hint">
            Pick a site and document library to import into Prisma. Open will launch the item on SharePoint in your
            browser.
          </p>

          <label className="field-label" htmlFor="sp-library-url">
            Or paste a library URL
          </label>
          <div className="detail-acc-link">
            <input
              id="sp-library-url"
              value={libraryUrl}
              placeholder="https://….sharepoint.com/sites/…/Library/Forms/AllItems.aspx"
              disabled={sharePoint.importing}
              onChange={(event) => setLibraryUrl(event.target.value)}
            />
            <button
              type="button"
              disabled={sharePoint.importing || libraryUrl.trim().length === 0}
              onClick={() => void actions.importSharePointFromUrl(libraryUrl, Boolean(index))}
            >
              {index ? "Merge URL" : "Import URL"}
            </button>
          </div>

          <label className="field-label" htmlFor="sp-site">
            Site
          </label>
          <SidebarSelect
            id="sp-site"
            value={selectedSiteId ?? ""}
            disabled={loadingSites || sharePoint.importing || sites.length === 0}
            options={[
              { value: "", label: loadingSites ? "Loading sites…" : "Select a site…" },
              ...sites.map((site) => ({ value: site.id, label: site.displayName })),
            ]}
            onChange={(value) => setSelectedSiteId(value || null)}
          />

          <label className="field-label" htmlFor="sp-drive">
            Document library
          </label>
          <SidebarSelect
            id="sp-drive"
            value={selectedDriveId ?? ""}
            disabled={!selectedSiteId || loadingDrives || sharePoint.importing || drives.length === 0}
            options={[
              { value: "", label: loadingDrives ? "Loading libraries…" : "Select a library…" },
              ...drives.map((drive) => ({ value: drive.id, label: drive.name })),
            ]}
            onChange={(value) => setSelectedDriveId(value || null)}
          />

          {(localError || sharePoint.message) && (
            <div className="stat-line">
              <span className="k">Status</span>
              <span className="v">{localError ?? sharePoint.message}</span>
            </div>
          )}

          <div className="detail-actions">
            <button
              type="button"
              className="primary"
              disabled={!canImport}
              onClick={() => {
                if (!selectedSite || !selectedDrive) {
                  return;
                }
                void actions.importSharePointDrive(selectedSite, selectedDrive, Boolean(index));
              }}
            >
              {sharePoint.importing ? "Importing…" : mergeLabel}
            </button>
            {sharePoint.importing ? (
              <button type="button" onClick={() => actions.cancelSharePointImport()}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
