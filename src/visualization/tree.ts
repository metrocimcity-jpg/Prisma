import type { VizNode } from "@/visualization/types";

export function findVizNode(root: VizNode, id: string): VizNode | null {
  if (root.id === id) {
    return root;
  }
  for (const child of root.children) {
    const found = findVizNode(child, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function focusedVizNode(root: VizNode, path: string[]): VizNode {
  let current = root;
  for (const id of path) {
    const next = current.children.find((child) => child.id === id) ?? findVizNode(root, id);
    if (!next) {
      break;
    }
    current = next;
  }
  return current;
}

function pathFromRoot(root: VizNode, match: (node: VizNode) => boolean): VizNode[] {
  const stack: VizNode[] = [];
  const found: VizNode[] = [];
  const walk = (node: VizNode): boolean => {
    if (match(node)) {
      found.push(...stack, node);
      return true;
    }
    stack.push(node);
    for (const child of node.children) {
      if (walk(child)) {
        return true;
      }
    }
    stack.pop();
    return false;
  };
  walk(root);
  if (found[0]?.id === root.id) {
    found.shift();
  }
  return found;
}

/** Groups from the map root down to the node with this id. */
export function vizPathById(root: VizNode, id: string): VizNode[] {
  return pathFromRoot(root, (node) => node.id === id);
}

/** Groups from the map root down to the file or folder with this index id. */
export function vizPathBySourceId(root: VizNode, sourceId: string): VizNode[] {
  return pathFromRoot(root, (node) => node.id !== root.id && node.sourceId === sourceId);
}
