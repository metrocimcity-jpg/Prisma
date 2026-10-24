import { stopVoice } from "@/voice/voiceListener";

type RecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export type AskDictationStatus = "idle" | "listening" | "unsupported" | "error";

export interface AskDictationHandlers {
  onStatus: (status: AskDictationStatus, message?: string) => void;
  onTranscript: (text: string, final: boolean) => void;
  onFinal: (text: string) => void;
}

let recognition: InstanceType<RecognitionCtor> | null = null;
let session = 0;

function recognitionCtor(): RecognitionCtor | null {
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function isAskDictationSupported(): boolean {
  return recognitionCtor() !== null;
}

export function stopAskDictation(): void {
  session += 1;
  const rec = recognition;
  recognition = null;
  if (!rec) {
    return;
  }
  rec.onend = null;
  rec.onresult = null;
  rec.onerror = null;
  try {
    rec.stop();
  } catch {
    try {
      rec.abort();
    } catch {
      // Already stopped.
    }
  }
}

/** One-shot mic capture into Ask Prisma (pauses command Voice if it is running). */
export function startAskDictation(handlers: AskDictationHandlers): void {
  stopAskDictation();
  stopVoice();

  const Ctor = recognitionCtor();
  if (!Ctor) {
    handlers.onStatus("unsupported", "Use Chrome for voice input.");
    return;
  }

  const current = ++session;
  const rec = new Ctor();
  recognition = rec;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 3;
  rec.lang = "en-US";

  let finalText = "";

  rec.onresult = (event) => {
    if (current !== session) {
      return;
    }
    let interim = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const piece = result?.[0]?.transcript?.trim() ?? "";
      if (!piece) {
        continue;
      }
      if (result.isFinal) {
        finalText = `${finalText} ${piece}`.trim();
        handlers.onTranscript(finalText, true);
      } else {
        interim = piece;
        handlers.onTranscript(`${finalText} ${interim}`.trim(), false);
      }
    }
  };

  rec.onerror = (event) => {
    if (current !== session || event.error === "aborted" || event.error === "no-speech") {
      return;
    }
    const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
    handlers.onStatus("error", denied ? "Allow the microphone in Chrome’s address bar." : "Voice input stopped.");
    stopAskDictation();
  };

  rec.onend = () => {
    if (current !== session) {
      return;
    }
    recognition = null;
    const text = finalText.trim();
    handlers.onStatus("idle");
    if (text) {
      handlers.onFinal(text);
    }
  };

  try {
    rec.start();
    handlers.onStatus("listening", "Listening… speak your ask");
  } catch (error) {
    recognition = null;
    handlers.onStatus("error", error instanceof Error ? error.message : "The microphone did not start.");
  }
}

export function toggleAskDictation(handlers: AskDictationHandlers, listening: boolean): void {
  if (listening) {
    stopAskDictation();
    handlers.onStatus("idle");
    return;
  }
  startAskDictation(handlers);
}
