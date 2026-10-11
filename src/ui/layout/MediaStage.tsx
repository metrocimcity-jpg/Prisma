import type { PreviewKind } from "@/utils/previewKind";
import { useEffect, useState } from "react";

interface MediaStageProps {
  src: string;
  kind: Extract<PreviewKind, "image" | "video" | "audio" | "text">;
  title: string;
}

export function MediaStage({ src, kind, title }: MediaStageProps): JSX.Element {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind !== "text") {
      return;
    }
    let cancelled = false;
    void fetch(src)
      .then((response) => response.text())
      .then((value) => {
        if (!cancelled) {
          setText(value.length > 200_000 ? `${value.slice(0, 200_000)}\n\n…truncated…` : value);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not read this text file");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [src, kind]);

  return (
    <div className="media-stage">
      {kind === "image" ? <img src={src} alt={title} /> : null}
      {kind === "video" ? <video src={src} controls title={title} /> : null}
      {kind === "audio" ? <audio src={src} controls title={title} /> : null}
      {kind === "text" ? <pre>{error ?? text ?? "Opening text…"}</pre> : null}
    </div>
  );
}
