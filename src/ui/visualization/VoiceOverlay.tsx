import { useVoiceState } from "@/voice/voiceListener";

const LEGEND: Array<[string, string]> = [
  ["Prisma", "Wake up"],
  ["Prisma down", "Go to sleep"],
  ["Ask …", "Semantic search on the map"],
  ["Select …", "Open that cell"],
  ["Select every cell", "Select all visible cells"],
  ["Back", "Go back"],
  ["Reset", "Reset the view"],
  ["Filter …", "Filter by type, extension, or name"],
];

export function VoiceOverlay(): JSX.Element | null {
  const voice = useVoiceState();
  if (voice.status === "off") {
    return null;
  }

  const title = voice.status === "error" ? "Voice unavailable" : voice.armed ? "Commands on" : "Paused";

  return (
    <aside className="voice-panel" aria-live="polite" aria-label="Voice commands">
      <div className="voice-head">
        <span className={voice.armed ? "voice-dot is-on" : voice.status === "error" ? "voice-dot is-error" : "voice-dot"} />
        <span className="voice-title">{title}</span>
      </div>
      {voice.message ? <p className="voice-message">{voice.message}</p> : null}
      <ul className="voice-legend">
        {LEGEND.map(([phrase, meaning]) => (
          <li key={phrase}>
            <span>{phrase}</span>
            {meaning}
          </li>
        ))}
      </ul>
    </aside>
  );
}
