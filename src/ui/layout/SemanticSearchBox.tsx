import { createPrismaApi, type PrismaAskResult } from "@/api/prismaApi";
import { formatBytes } from "@/utils/format";
import {
  isAskDictationSupported,
  startAskDictation,
  stopAskDictation,
  type AskDictationStatus,
} from "@/voice/askDictation";
import { useEffect, useState } from "react";

const EXAMPLE = "all revit models for airfield location for last month";

const api = createPrismaApi();

export function SemanticSearchBox(): JSX.Element {
  const [ask, setAsk] = useState("");
  const [result, setResult] = useState<PrismaAskResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dictation, setDictation] = useState<AskDictationStatus>("idle");
  const [dictationMessage, setDictationMessage] = useState("");
  const voiceOk = isAskDictationSupported();

  useEffect(() => () => stopAskDictation(), []);

  function runAsk(text: string): void {
    const query = text.trim();
    if (!query) {
      return;
    }
    setBusy(true);
    try {
      const next = api.ask(query);
      setResult(next);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic(autoShow: boolean): void {
    if (dictation === "listening") {
      stopAskDictation();
      setDictation("idle");
      setDictationMessage("");
      return;
    }
    startAskDictation({
      onStatus: (status, message) => {
        setDictation(status);
        setDictationMessage(message ?? "");
      },
      onTranscript: (text) => {
        setAsk(text);
      },
      onFinal: (text) => {
        setAsk(text);
        setDictation("idle");
        setDictationMessage("");
        if (autoShow) {
          runAsk(text);
        }
      },
    });
  }

  return (
    <div className="semantic-ask">
      <div className="semantic-ask-head">
        <h3>Ask Prisma</h3>
        <span className="semantic-ask-hint">Natural language over the loaded JSON index</span>
      </div>
      <div className={`semantic-ask-field${dictation === "listening" ? " is-listening" : ""}`}>
        <label className="sr-only" htmlFor="semantic-ask-input">
          Ask for a file in plain English
        </label>
        <textarea
          id="semantic-ask-input"
          className="semantic-ask-input"
          rows={3}
          value={ask}
          placeholder={EXAMPLE}
          onChange={(event) => setAsk(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              runAsk(ask);
            }
          }}
        />
        <div className="semantic-ask-voice" role="group" aria-label="Voice input">
          <button
            type="button"
            className={`semantic-ask-mic${dictation === "listening" ? " is-on" : ""}`}
            title={dictation === "listening" ? "Stop listening" : "Speak your ask"}
            aria-pressed={dictation === "listening"}
            disabled={!voiceOk || dictation === "unsupported"}
            onClick={() => toggleMic(false)}
          >
            <MicIcon />
            <span className="sr-only">{dictation === "listening" ? "Stop listening" : "Speak your ask"}</span>
          </button>
          <button
            type="button"
            className={`semantic-ask-speak${dictation === "listening" ? " is-on" : ""}`}
            title={dictation === "listening" ? "Stop listening" : "Speak and show on map"}
            disabled={!voiceOk || dictation === "unsupported"}
            onClick={() => toggleMic(true)}
          >
            {dictation === "listening" ? "Listening…" : "Speak to map"}
          </button>
        </div>
      </div>
      {dictationMessage ? <p className="semantic-ask-voice-status">{dictationMessage}</p> : null}
      <div className="semantic-ask-actions">
        <button type="button" className="semantic-ask-run" disabled={busy || ask.trim().length === 0} onClick={() => runAsk(ask)}>
          Show on map
        </button>
        <button
          type="button"
          className="semantic-ask-example"
          onClick={() => {
            setAsk(EXAMPLE);
            runAsk(EXAMPLE);
          }}
        >
          Try example
        </button>
      </div>
      {result ? <AskResultCard result={result} onSelect={(id) => api.select(id)} /> : null}
    </div>
  );
}

function MicIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"
      />
    </svg>
  );
}

function AskResultCard({ result, onSelect }: { result: PrismaAskResult; onSelect: (id: string) => void }): JSX.Element {
  if (result.hits.length === 0) {
    return <p className="semantic-ask-empty">No file in the loaded JSON matched that ask.</p>;
  }
  const favorite = result.favorite;
  return (
    <div className="semantic-ask-result">
      {favorite ? (
        <button type="button" className="semantic-ask-favorite" onClick={() => onSelect(favorite.id)}>
          <span className="semantic-ask-kicker">
            {result.intent.wantAll && result.hits.length > 1 ? `${result.hits.length} matches · top` : "Favorite"}
          </span>
          <span className="semantic-ask-name">{favorite.name}</span>
          <span className="semantic-ask-meta">
            {favorite.relativePath} · {formatBytes(favorite.size)}
          </span>
          {result.hits[0]?.reasons.length ? (
            <span className="semantic-ask-reasons">{result.hits[0].reasons.slice(0, 5).join(" · ")}</span>
          ) : null}
        </button>
      ) : null}
      <ul className="semantic-ask-hits">
        {result.hits.slice(0, 6).map((hit) => (
          <li key={hit.id}>
            <button type="button" onClick={() => onSelect(hit.id)}>
              <span>{hit.node.name}</span>
              <span>{formatBytes(hit.node.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="semantic-ask-applied">
        {result.hits.length > 0
          ? `${result.hits.length} file${result.hits.length === 1 ? "" : "s"} highlighted on the FoamTree map`
          : "Nothing to show on the map"}
        {result.appliedSearch ? ` · ${result.appliedSearch}` : ""}
      </p>
    </div>
  );
}
