import { isIfcFile } from "@/utils/ifc";
import { isPdfFile } from "@/utils/pdf";

export type PreviewKind = "pdf" | "ifc" | "image" | "video" | "audio" | "text";

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const VIDEO = new Set(["mp4", "webm", "mov", "ogg"]);
const AUDIO = new Set(["mp3", "wav", "flac", "m4a"]);
const TEXT = new Set(["txt", "md", "json", "csv", "log", "xml", "yaml", "yml"]);

function extensionOf(node: { name: string; extension: string | null }): string {
  const fromField = (node.extension ?? "").replace(/^\./, "").toLowerCase();
  if (fromField.length > 0) {
    return fromField;
  }
  const dot = node.name.lastIndexOf(".");
  if (dot <= 0 || dot === node.name.length - 1) {
    return "";
  }
  return node.name.slice(dot + 1).toLowerCase();
}

export function previewKind(node: { name: string; extension: string | null; mimeType?: string | null }): PreviewKind | null {
  if (isPdfFile(node)) {
    return "pdf";
  }
  if (isIfcFile(node)) {
    return "ifc";
  }
  const extension = extensionOf(node);
  if (IMAGE.has(extension)) {
    return "image";
  }
  if (VIDEO.has(extension)) {
    return "video";
  }
  if (AUDIO.has(extension)) {
    return "audio";
  }
  if (TEXT.has(extension)) {
    return "text";
  }
  const mime = (node.mimeType ?? "").toLowerCase();
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("text/")) {
    return "text";
  }
  return null;
}
