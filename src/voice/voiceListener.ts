import { applyVoiceCommand } from "@/voice/applyVoiceCommand";
import { normalizeSpeech, parseVoiceUtterance, type VoiceCommand } from "@/voice/parseVoiceUtterance";
import { useSyncExternalStore } from "react";

export type VoiceStatus = "off" | "on" | "error";

export interface VoiceState {
  status: VoiceStatus;
  armed: boolean;
  message: string;
}

const asleep: VoiceState = { status: "off", armed: false, message: "" };
let state: VoiceState = asleep;
const listeners = new Set<() => void>();

function setState(patch: Partial<VoiceState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVoiceState(): VoiceState {
  return state;
}

export function useVoiceState(): VoiceState {
  return useSyncExternalStore(subscribe, getVoiceState);
}

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechResult>;
}

interface GrammarList {
  addFromString: (grammar: string, weight: number) => void;
}

interface BrowserRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  grammars?: GrammarList;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => BrowserRecognition;

function recognitionCtor(): RecognitionCtor | null {
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

let session = 0;
let recognition: BrowserRecognition | null = null;
let lastHeard = "";
let lastHeardAt = 0;
let draftText = "";
let draftTimer = 0;

function chooseTranscript(result: SpeechResult): string {
  const options: string[] = [];
  const count = result.length > 0 ? result.length : 1;
  for (let index = 0; index < count; index += 1) {
    const text = result[index]?.transcript?.trim();
    if (text) {
      options.push(text);
    }
  }
  if (options.length === 0) {
    return "";
  }
  const ranked = options
    .map((text) => ({ text, commands: parseVoiceUtterance(text) }))
    .sort((left, right) => commandScore(right.commands) - commandScore(left.commands));
  return commandScore(ranked[0].commands) > 0 ? ranked[0].text : options[0];
}

function commandScore(commands: VoiceCommand[]): number {
  if (commands.length === 0) {
    return 0;
  }
  const action = commands.some((command) => command.type !== "wake" && command.type !== "sleep");
  const addressed = commands.some((command) => command.type === "wake" || command.type === "sleep");
  return (action ? 2 : 0) + (addressed ? 1 : 0);
}

function latestUtterance(event: SpeechResultEvent): { text: string; final: boolean } {
  const list = event.results;
  if (!list || list.length === 0) {
    return { text: "", final: false };
  }
  const result = list[list.length - 1];
  if (!result) {
    return { text: "", final: false };
  }
  return { text: chooseTranscript(result), final: result.isFinal === true };
}

function attachGrammar(rec: BrowserRecognition): void {
  const host = window as Window & {
    SpeechGrammarList?: new () => GrammarList;
    webkitSpeechGrammarList?: new () => GrammarList;
  };
  const Ctor = host.SpeechGrammarList ?? host.webkitSpeechGrammarList;
  if (!Ctor) {
    return;
  }
  try {
    const list = new Ctor();
    list.addFromString(
      "#JSGF V1.0; grammar prisma; public <command> = prisma | prism | prisma down | select every cell | select all the cells | back | go back | reset | reset the view | filter | clear filters | ask | find | show on map;",
      1,
    );
    rec.grammars = list;
  } catch {
    // The cloud recognizer often ignores this list. Matching still covers the mishearings.
  }
}

export function startVoice(): void {
  if (state.status === "on") {
    return;
  }
  const Ctor = recognitionCtor();
  if (!Ctor) {
    setState({ status: "error", armed: false, message: "Use Chrome for voice commands." });
    return;
  }
  const current = ++session;
  const rec = new Ctor();
  recognition = rec;
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.lang = "en-US";
  attachGrammar(rec);
  rec.onresult = (event) => {
    if (current !== session) {
      return;
    }
    hear(latestUtterance(event));
  };
  rec.onerror = (event) => {
    if (current !== session || event.error === "no-speech" || event.error === "aborted") {
      return;
    }
    const denied = event.error === "not-allowed" || event.error === "service-not-allowed";
    session += 1;
    setState({
      status: "error",
      armed: false,
      message: denied ? "Allow the microphone in Chrome’s address bar." : "Speech recognition stopped.",
    });
  };
  rec.onend = () => {
    if (current !== session) {
      return;
    }
    flushDraft();
    window.setTimeout(() => {
      if (current !== session) {
        return;
      }
      try {
        rec.start();
      } catch {
        // Chrome can still be shutting the previous pass down.
      }
    }, 250);
  };
  try {
    rec.start();
    setState({ status: "on", armed: true, message: "Commands on. Say ask, select, back, reset, or filter." });
  } catch (error) {
    session += 1;
    setState({
      status: "error",
      armed: false,
      message: error instanceof Error ? error.message : "The microphone did not start.",
    });
  }
}

export function stopVoice(): void {
  session += 1;
  const rec = recognition;
  recognition = null;
  if (rec) {
    rec.onend = null;
    rec.onresult = null;
    rec.onerror = null;
    try {
      rec.stop();
    } catch {
      // Already stopped.
    }
  }
  lastHeard = "";
  draftText = "";
  window.clearTimeout(draftTimer);
  setState(asleep);
}

function hear(utterance: { text: string; final: boolean }): void {
  const spoken = utterance.text.trim();
  if (!spoken) {
    return;
  }
  draftText = spoken;
  const key = normalizeSpeech(spoken);
  if (!(key === lastHeard && performance.now() - lastHeardAt < 1200)) {
    setState({ message: spoken });
  }
  window.clearTimeout(draftTimer);
  if (utterance.final) {
    draftText = "";
    accept(spoken);
    return;
  }
  draftTimer = window.setTimeout(() => {
    if (draftText !== spoken) {
      return;
    }
    draftText = "";
    accept(spoken);
  }, 700);
}

function flushDraft(): void {
  window.clearTimeout(draftTimer);
  if (!draftText) {
    return;
  }
  const pending = draftText;
  draftText = "";
  accept(pending);
}

export function toggleVoice(): void {
  if (state.status === "on") {
    stopVoice();
  } else {
    startVoice();
  }
}

function accept(transcript: string): void {
  const key = normalizeSpeech(transcript);
  const now = performance.now();
  if (!key || (key === lastHeard && now - lastHeardAt < 1200)) {
    return;
  }
  const commands = parseVoiceUtterance(transcript);
  const addressed = commands.some((command) => command.type === "wake" || command.type === "sleep");
  const actionable = commands.some((command) => command.type !== "wake" && command.type !== "sleep");
  if (!addressed && !actionable && !state.armed) {
    setState({ message: `Heard “${transcript.trim()}”. Say Prisma to wake.` });
    return;
  }
  lastHeard = key;
  lastHeardAt = now;

  let armed = state.armed;
  let message = transcript.trim();
  for (const command of commands) {
    if (command.type === "sleep") {
      armed = false;
      message = "Asleep. Say Prisma.";
      continue;
    }
    if (command.type === "wake") {
      armed = true;
      if (message === transcript.trim()) {
        message = "Listening";
      }
      continue;
    }
    if (armed) {
      message = run(command);
    }
  }
  if (!armed && !addressed) {
    message = `Heard “${transcript.trim()}”. Say Prisma to wake.`;
  } else if (message === transcript.trim()) {
    message = `Heard “${transcript.trim()}”. Try ask, select, back, reset, or filter.`;
  }
  setState({ armed, message });
}

function run(command: VoiceCommand): string {
  try {
    return applyVoiceCommand(command);
  } catch (error) {
    return error instanceof Error ? error.message : "That command did not run.";
  }
}
