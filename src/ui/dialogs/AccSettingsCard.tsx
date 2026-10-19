import { actions, usePrisma } from "@/state/store";
import { applyAccProjectFromUrl, type AccSettings } from "@/acc/settings";
import { useEffect, useState } from "react";

export function AccSettingsCard(): JSX.Element {
  const { acc } = usePrisma();
  const [draft, setDraft] = useState<AccSettings>(acc.settings);
  const [projectUrl, setProjectUrl] = useState("");

  useEffect(() => {
    setDraft(acc.settings);
  }, [acc.settings]);

  return (
    <div className="card acc-settings-card">
      <h3>Autodesk Construction Cloud</h3>
      <p className="detail-hint">
        Prisma matches loaded files to ACC, saves each file’s data sheet on this computer, and adds those fields to
        Group by. Later sessions can sort by those fields without signing in again. Create a
        free APS app and add this callback URL:{" "}
        <code>
          {typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "http://127.0.0.1:4173/"}
        </code>
      </p>

      <label className="field-label" htmlFor="aps-client-id">
        APS Client ID
      </label>
      <input
        id="aps-client-id"
        value={draft.clientId}
        placeholder="Your Autodesk Platform Services app client id"
        onChange={(event) => setDraft({ ...draft, clientId: event.target.value })}
      />

      <label className="field-label" htmlFor="aps-client-secret">
        APS Client Secret
      </label>
      <input
        id="aps-client-secret"
        type="password"
        autoComplete="off"
        value={draft.clientSecret}
        placeholder="Required for a Traditional Web App. Leave blank for PKCE."
        onChange={(event) => setDraft({ ...draft, clientSecret: event.target.value })}
      />

      <label className="field-label" htmlFor="acc-project-id">
        ACC Project ID
      </label>
      <input
        id="acc-project-id"
        value={draft.projectId}
        placeholder="GUID from ACC URL /docs/files/projects/&lt;id&gt;"
        onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
      />

      <label className="field-label" htmlFor="acc-project-url">
        Or paste any ACC Docs URL to fill Project ID
      </label>
      <div className="detail-acc-link">
        <input
          id="acc-project-url"
          value={projectUrl}
          placeholder="https://acc.autodesk.com/docs/files/projects/…"
          onChange={(event) => setProjectUrl(event.target.value)}
        />
        <button
          type="button"
          onClick={() => {
            const next = applyAccProjectFromUrl(projectUrl, draft);
            setDraft(next);
          }}
        >
          Use URL
        </button>
      </div>

      <div className="detail-actions">
        <button
          type="button"
          className="primary"
          onClick={() => {
            actions.saveAccSettings(draft);
          }}
        >
          Save ACC settings
        </button>
        {acc.signedIn ? (
          <button type="button" onClick={() => actions.signOutAcc()}>
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              actions.saveAccSettings(draft);
              void actions.signInAcc();
            }}
          >
            Sign in to ACC
          </button>
        )}
        <button type="button" disabled={acc.resolving} onClick={() => void actions.resolveAccLinks()}>
          {acc.resolving ? "Reading ACC…" : "Resolve ACC links"}
        </button>
      </div>
      <div className="stat-line">
        <span className="k">Status</span>
        <span className="v">{acc.signedIn ? "Signed in" : "Not signed in"}</span>
      </div>
      {acc.resolveMessage ? (
        <div className="stat-line">
          <span className="k">Links</span>
          <span className="v">{acc.resolveMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
