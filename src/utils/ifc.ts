export function isIfcFile(node: { name: string; extension: string | null }): boolean {
  const extension = (node.extension ?? "").replace(/^\./, "").toLowerCase();
  if (extension === "ifc") {
    return true;
  }
  return node.name.toLowerCase().endsWith(".ifc");
}
