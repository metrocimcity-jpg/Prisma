/**
 * Ensures read permission, then returns a File for the handle.
 */
export async function readLocalFile(handle: FileSystemFileHandle): Promise<File> {
  const permissionHandle = handle as FileSystemFileHandle & {
    queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
    requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  };
  if (typeof permissionHandle.queryPermission === "function") {
    const current = await permissionHandle.queryPermission({ mode: "read" });
    if (current === "granted") {
      return handle.getFile();
    }
  }
  if (typeof permissionHandle.requestPermission === "function") {
    const permission = await permissionHandle.requestPermission({ mode: "read" });
    if (permission !== "granted") {
      throw new Error("Permission to read this file was denied.");
    }
  }
  return handle.getFile();
}

function triggerDownload(url: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Saves a local File System Access handle to disk (no browser tab).
 * Prefers the Save As picker; falls back to a download.
 * Browsers cannot launch Revit/AutoCAD — the user opens the saved file themselves.
 */
export async function openLocalFileHandle(
  handle: FileSystemFileHandle,
  options?: { startIn?: FileSystemDirectoryHandle },
): Promise<"saved" | "downloaded"> {
  const file = await readLocalFile(handle);

  if (typeof window.showSaveFilePicker === "function") {
    try {
      const output = await window.showSaveFilePicker({
        suggestedName: file.name,
        // A file handle opens the dialog in that file's folder, not the scanned root.
        startIn: options?.startIn ?? handle,
      });
      const writable = await output.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      return "saved";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Save cancelled.");
      }
      // Fall through to download if Save As is unavailable/blocked.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    triggerDownload(url, file.name);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return "downloaded";
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** @deprecated use openLocalFileHandle */
export async function downloadFileHandle(handle: FileSystemFileHandle): Promise<void> {
  await openLocalFileHandle(handle);
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}
