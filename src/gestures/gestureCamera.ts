import { GestureInterpreter, type GestureCommand, type GestureReadout, type HandPoint } from "@/gestures/gestureLogic";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
import { useSyncExternalStore } from "react";

const WASM_BASE = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export type GestureStatus = "off" | "loading" | "on" | "error";

export interface GestureState {
  status: GestureStatus;
  message: string;
  readout: GestureReadout;
  landmarks: HandPoint[] | null;
}

const idleReadout: GestureReadout = { label: "No hand", progress: 0, pinching: false, cursor: null };

let state: GestureState = { status: "off", message: "", readout: idleReadout, landmarks: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<GestureState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGestureState(): GestureState {
  return state;
}

export function useGestureState(): GestureState {
  return useSyncExternalStore(subscribe, getGestureState);
}

export function useGestureStatus(): GestureStatus {
  return useSyncExternalStore(subscribe, () => state.status);
}

type CommandHandler = (command: GestureCommand) => void;

let handler: CommandHandler | null = null;

/** The visualization that should receive gesture commands; null detaches it. */
export function setGestureCommandHandler(next: CommandHandler | null): void {
  handler = next;
}

let recognizerPromise: Promise<GestureRecognizer> | null = null;

async function loadRecognizer(): Promise<GestureRecognizer> {
  const { FilesetResolver, GestureRecognizer } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const options = { numHands: 1, runningMode: "VIDEO" as const, minHandDetectionConfidence: 0.6, minTrackingConfidence: 0.5 };
  const model = { modelAssetPath: MODEL_URL };
  try {
    return await withTimeout(
      GestureRecognizer.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...model, delegate: "GPU" },
      }),
      8000,
      "The GPU hand model did not start.",
    );
  } catch {
    return GestureRecognizer.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...model, delegate: "CPU" },
    });
  }
}

let video: HTMLVideoElement | null = null;
let stream: MediaStream | null = null;
let frame = 0;
let session = 0;
const interpreter = new GestureInterpreter();

export function getGestureVideo(): HTMLVideoElement | null {
  return video;
}

export async function startGestures(): Promise<void> {
  if (state.status === "loading" || state.status === "on") {
    return;
  }
  const current = ++session;
  setState({ status: "loading", message: "Allow the camera in Chrome’s address bar." });
  try {
    if (!window.isSecureContext) {
      throw new Error("Chrome only allows the camera on localhost or https.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser has no camera access.");
    }
    const media = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false,
    });
    if (current !== session) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = media;
    const element = document.createElement("video");
    element.muted = true;
    element.playsInline = true;
    element.srcObject = media;
    await element.play();
    video = element;
    setState({ status: "on", message: "Loading hand model…" });

    recognizerPromise ??= loadRecognizer();
    const recognizer = await recognizerPromise;
    if (current !== session) {
      return;
    }
    interpreter.reset();
    setState({ status: "on", message: "" });
    loop(recognizer, current);
  } catch (error) {
    recognizerPromise = null;
    releaseCamera();
    const denied = error instanceof DOMException && error.name === "NotAllowedError";
    setState({
      status: "error",
      message: denied ? "Camera permission was denied." : error instanceof Error ? error.message : String(error),
    });
  }
}

export function stopGestures(): void {
  session += 1;
  window.cancelAnimationFrame(frame);
  frame = 0;
  releaseCamera();
  interpreter.reset();
  handler?.({ type: "leave" });
  setState({ status: "off", message: "", readout: idleReadout, landmarks: null });
}

export function toggleGestures(): void {
  if (state.status === "off" || state.status === "error") {
    void startGestures();
  } else {
    stopGestures();
  }
}

function releaseCamera(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video) {
    video.srcObject = null;
  }
  video = null;
}

function loop(recognizer: GestureRecognizer, current: number): void {
  let lastVideoTime = -1;
  const tick = (): void => {
    if (current !== session || !video) {
      return;
    }
    frame = window.requestAnimationFrame(tick);
    if (video.readyState < 2 || video.currentTime === lastVideoTime) {
      return;
    }
    lastVideoTime = video.currentTime;
    const now = performance.now();
    const result = recognizer.recognizeForVideo(video, now);
    const landmarks = result.landmarks[0];
    const top = result.gestures[0]?.[0];
    const step = interpreter.step(
      landmarks ? { landmarks, gesture: top?.categoryName ?? "None", score: top?.score ?? 0 } : null,
      now,
    );
    step.commands.forEach((command) => handler?.(command));
    setState({ readout: step.readout, landmarks: landmarks ?? null });
  };
  frame = window.requestAnimationFrame(tick);
}
