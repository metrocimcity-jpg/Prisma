import { actions, usePrisma } from "@/state/store";
import { IfcStage } from "@/ui/layout/IfcStage";
import { MediaStage } from "@/ui/layout/MediaStage";
import { PdfStage } from "@/ui/layout/PdfStage";
import { previewKind, type PreviewKind } from "@/utils/previewKind";
import { findVizNode } from "@/visualization/tree";
import { useEffect, useState } from "react";

type Phase = "empty" | "other" | "loading" | "ready" | "missing" | "error";

export function PreviewPanel(): JSX.Element | null {
  const { panels, selectedId, index, handles, vizTree } = usePrisma();
  const [phase, setPhase] = useState<Phase>("empty");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [ifcFile, setIfcFile] = useState<File | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const node = selectedId && index ? (index.items.find((item) => item.id === selectedId) ?? null) : null;
  const group = !node && selectedId && vizTree ? findVizNode(vizTree, selectedId) : null;
  const previewFile = node?.nodeType === "file" ? node : null;
  const kind: PreviewKind | null = previewFile ? previewKind(previewFile) : null;
  const linked = Boolean(previewFile && handles.get(previewFile.id)?.kind === "file");

  useEffect(() => {
    if (!previewFile || !kind) {
      setPdfUrl(null);
      setIfcFile(null);
      setNote(null);
      setPhase(node || group ? "other" : "empty");
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setPhase("loading");
    setNote(null);
    setPdfUrl(null);
    setIfcFile(null);
    void actions.loadLocalPreview(previewFile.id, false).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === "ready") {
        if (kind === "ifc") {
          setIfcFile(result.file);
        } else {
          objectUrl = URL.createObjectURL(result.file);
          setPdfUrl(objectUrl);
        }
        setPhase("ready");
        return;
      }
      if (result.status === "missing") {
        setPhase("missing");
        return;
      }
      if (result.status === "error") {
        setNote(result.message);
        setPhase("error");
        return;
      }
      setPhase("other");
    });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedId, previewFile, kind, linked, node, group]);

  if (!panels.preview) {
    return null;
  }

  const locate = async (): Promise<void> => {
    if (!previewFile || !kind) {
      return;
    }
    setLocating(true);
    setNote(null);
    const result = await actions.loadLocalPreview(previewFile.id, true);
    setLocating(false);
    if (result.status === "cancelled") {
      return;
    }
    if (result.status === "error") {
      setNote(result.message);
      setPhase("error");
      return;
    }
    if (result.status === "missing") {
      setNote(`Cannot find “${result.name}” in that folder.`);
      setPhase("missing");
    }
  };

  const fileName = node?.nodeType === "file" ? node.name : null;
  const loadingLabel = kind === "ifc" ? "Loading IFC…" : kind === "pdf" ? "Loading PDF…" : "Loading preview…";
  const mediaKind = kind === "image" || kind === "video" || kind === "audio" || kind === "text" ? kind : null;

  return (
    <aside className="preview-panel" aria-label="File preview">
      <div className="settings-tools">
        <h2>Preview</h2>
        <button type="button" className="ghost" onClick={() => actions.setPanel("preview", false)}>
          Close
        </button>
      </div>
      {fileName ? <p className="preview-name">{fileName}</p> : null}
      {phase === "ready" && kind === "pdf" && pdfUrl ? <PdfStage src={pdfUrl} title={previewFile?.name ?? "PDF"} /> : null}
      {phase === "ready" && kind === "ifc" && ifcFile ? <IfcStage file={ifcFile} title={previewFile?.name ?? "IFC"} /> : null}
      {phase === "ready" && mediaKind && pdfUrl ? <MediaStage src={pdfUrl} kind={mediaKind} title={previewFile?.name ?? "File"} /> : null}
      {phase === "ready" ? null : (
        <div className="preview-message">
          {phase === "loading" || locating ? (
            <p>{loadingLabel} Online Autodesk Docs files download when opened.</p>
          ) : null}
          {phase === "empty" ? <p>Select a file in the map to preview it here.</p> : null}
          {phase === "other" && fileName ? (
            <p>Preview can open PDF, IFC, images, video, audio, and text. “{fileName}” needs its own desktop app.</p>
          ) : null}
          {phase === "other" && !fileName ? <p>Select a file to preview it.</p> : null}
          {phase === "missing" && !locating ? (
            <>
              <p>This file is in the index, but the file itself is not open yet.</p>
              {note ? <p>{note}</p> : null}
              <button type="button" className="primary" onClick={() => void locate()}>
                Locate folder
              </button>
            </>
          ) : null}
          {phase === "error" ? <p>{note ?? "Could not preview this file."}</p> : null}
        </div>
      )}
    </aside>
  );
}
