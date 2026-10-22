import { focusedVizNode } from "@/visualization/tree";
import type { VizNode } from "@/visualization/types";
import { normalizeSpeech } from "@/voice/parseVoiceUtterance";

/** Best cell under the current view for a spoken name. The view root itself is not a cell. */
export function matchCell(root: VizNode, focusPath: string[], spoken: string): VizNode | null {
  const needle = normalizeSpeech(spoken);
  if (!needle) {
    return null;
  }
  const scope = focusedVizNode(root, focusPath);
  let bestNode: VizNode | null = null;
  let bestScore = 0;
  let bestDepth = Number.POSITIVE_INFINITY;
  const walk = (node: VizNode, depth: number): void => {
    if (depth > 0) {
      const score = scoreLabel(node.label, needle);
      if (score > bestScore || (score === bestScore && score > 0 && depth < bestDepth)) {
        bestNode = node;
        bestScore = score;
        bestDepth = depth;
      }
    }
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  };
  walk(scope, 0);
  return bestNode;
}

function scoreLabel(label: string, needle: string): number {
  const text = normalizeSpeech(label);
  if (!text) {
    return 0;
  }
  if (text === needle) {
    return 100;
  }
  if (text.startsWith(needle)) {
    return 80;
  }
  if (text.includes(needle)) {
    return 60;
  }
  return 0;
}
