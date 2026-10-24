import { createPrismaApi, type PrismaAskResult } from "@/api/prismaApi";
import { splitSemanticAsks } from "@/search/semanticSearch";
import { actions } from "@/state/store";
import { formatBytes } from "@/utils/format";
import {
  isAskDictationSupported,
  startAskDictation,
  stopAskDictation,
  type AskDictationStatus,
} from "@/voice/askDictation";
import { useEffect, useRef, useState } from "react";

/** One-click semantic chips — toggle several for a multi-search with “ / ”. */
const QUICK_ASKS = [
  "3 newer revit",
  "last month pdfs",
  "two weeks ago dwg",
  "Architectural revit models",
  "electrical revit models",
  "drawings runway 05",
  "ACC-Discipline=ELE7",
] as const;

const PLACEHOLDER = "Ask for a file";

const api = createPrismaApi();

export function SemanticSearchBox({ onRecordingChange }: { onRecordingChange?: (recording: boolean) => void }): JSX.Element {
  const [ask, setAsk] = useState("");
  const [result, setResult] = useState<PrismaAskResult | null>(null);
  const [dictation, setDictation] = useState<AskDictationStatus>("idle");
  const [dictationMessage, setDictationMessage] = useState("");
  const voiceOk = isAskDictationSupported();
  const activeParts = new Set(splitSemanticAsks(ask).map((part) => part.toLowerCase()));
  const askRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const node = askRef.current;
    if (!node) {
      return;
    }
    node.style.height = "0px";
    node.style.height = `${node.scrollHeight}px`;
  }, [ask]);

  useEffect(() => {
    onRecordingChange?.(dictation === "listening");
  }, [dictation, onRecordingChange]);

  useEffect(
    () => () => {
      stopAskDictation();
      onRecordingChange?.(false);
    },
    [onRecordingChange],
  );

  function runAsk(text: string): void {
    const query = text.trim();
    if (!query) {
      return;
    }
    const next = api.ask(query);
    setResult(next);
  }

  function toggleChip(chip: string): void {
    const parts = splitSemanticAsks(ask);
    const index = parts.findIndex((part) => part.toLowerCase() === chip.toLowerCase());
    const next =
      index >= 0 ? [...parts.slice(0, index), ...parts.slice(index + 1)] : [...parts, chip];
    const joined = next.join(" / ");
    setAsk(joined);
    if (next.length > 0) {
      runAsk(joined);
    } else {
      setResult(null);
      actions.clearSemanticHits();
    }
  }

  function toggleMic(): void {
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
      },
    });
  }

  const partCount = splitSemanticAsks(ask).length;

  return (
    <div className="semantic-ask">
      <div className="semantic-ask-head">
        <h3>Ask Prisma</h3>
      </div>
      <div className="semantic-ask-chips" role="group" aria-label="Quick semantic asks">
        {QUICK_ASKS.map((chip) => {
          const on = activeParts.has(chip.toLowerCase());
          return (
            <button
              key={chip}
              type="button"
              className={`semantic-ask-chip${on ? " is-on" : ""}`}
              aria-pressed={on}
              title={on ? `Remove “${chip}”` : `Add “${chip}”`}
              onClick={() => toggleChip(chip)}
            >
              {chip}
            </button>
          );
        })}
      </div>
      <div className={`semantic-ask-field${dictation === "listening" ? " is-listening" : ""}`}>
        <label className="sr-only" htmlFor="semantic-ask-input">
          Ask for a file in plain English
        </label>
        <textarea
          ref={askRef}
          id="semantic-ask-input"
          className="semantic-ask-input"
          rows={1}
          value={ask}
          placeholder={PLACEHOLDER}
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
            onClick={() => toggleMic()}
          >
            <MicIcon />
            <span className="sr-only">{dictation === "listening" ? "Stop listening" : "Speak your ask"}</span>
          </button>
        </div>
      </div>
      {dictationMessage ? <p className="semantic-ask-voice-status">{dictationMessage}</p> : null}
      {result ? <AskResultCard result={result} partCount={partCount} onSelect={(id) => api.select(id)} /> : null}
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

function AskResultCard({
  result,
  partCount,
  onSelect,
}: {
  result: PrismaAskResult;
  partCount: number;
  onSelect: (id: string) => void;
}): JSX.Element {
  if (result.hits.length === 0) {
    return <p className="semantic-ask-empty">No file in the loaded JSON matched that ask.</p>;
  }
  const favorite = result.favorite;
  const fallback = result.usedFallback === true;
  return (
    <div className="semantic-ask-result">
      {fallback ? (
        <p className="semantic-ask-empty">No exact match — showing sample files on the map.</p>
      ) : null}
      {favorite ? (
        <button type="button" className="semantic-ask-favorite" onClick={() => onSelect(favorite.id)}>
          <span className="semantic-ask-kicker">
            {fallback
              ? `Sample · ${result.hits.length} files`
              : partCount > 1
                ? `${partCount} asks · ${result.hits.length} files`
                : result.intent.wantAll && result.hits.length > 1
                  ? `${result.hits.length} matches · top`
                  : "Favorite"}
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
        {result.hits.slice(0, 8).map((hit) => (
          <li key={hit.id}>
            <button type="button" onClick={() => onSelect(hit.id)}>
              <span>{hit.node.name}</span>
              <span>{formatBytes(hit.node.size)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="semantic-ask-applied">
        {fallback
          ? `${result.hits.length} sample file${result.hits.length === 1 ? "" : "s"} on the FoamTree map (unrelated)`
          : result.hits.length > 0
            ? `${result.hits.length} file${result.hits.length === 1 ? "" : "s"} on the FoamTree map`
            : "Nothing to show on the map"}
        {!fallback && partCount > 1 ? ` · ${partCount} asks` : ""}
        {!fallback && result.appliedSearch ? ` · ${result.appliedSearch}` : ""}
      </p>
    </div>
  );
}
