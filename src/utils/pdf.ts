export function isPdfFile(node: { name: string; extension: string | null; mimeType?: string | null }): boolean {
  const extension = (node.extension ?? "").replace(/^\./, "").toLowerCase();
  if (extension === "pdf") {
    return true;
  }
  if ((node.mimeType ?? "").toLowerCase() === "application/pdf") {
    return true;
  }
  return node.name.toLowerCase().endsWith(".pdf");
}
