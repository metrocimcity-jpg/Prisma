import type { FoamTree } from "@carrotsearch/foamtree";

const HOST_FOAM = "__prismaFoam";
const HOST_PRESERVE = "__prismaPreserveSelectionUntil";

type FoamHost = HTMLElement & { [HOST_FOAM]?: FoamTree; [HOST_PRESERVE]?: number };

let instance: FoamTree | null = null;
let preserveUntil = 0;

function foamHost(): FoamHost | null {
  if (typeof document === "undefined") {
    return null;
  }
  const host = document.querySelector(".foamtree-host");
  return host instanceof HTMLElement ? host : null;
}

/** Keep a multi-cell selection from being collapsed by the next selected-id sync. */
export function preserveFoamSelection(ms = 1500): void {
  const until = Date.now() + ms;
  preserveUntil = until;
  const host = foamHost();
  if (host) {
    host[HOST_PRESERVE] = until;
  }
}

export function isFoamSelectionPreserved(): boolean {
  if (Date.now() < preserveUntil) {
    return true;
  }
  const until = foamHost()?.[HOST_PRESERVE] ?? 0;
  return Date.now() < until;
}

export function setFoamTreeInstance(next: FoamTree | null): void {
  instance = next;
  const host = foamHost();
  if (!host) {
    return;
  }
  if (next) {
    host[HOST_FOAM] = next;
  } else {
    delete host[HOST_FOAM];
  }
}

export function getFoamTreeInstance(): FoamTree | null {
  if (instance) {
    return instance;
  }
  return foamHost()?.[HOST_FOAM] ?? null;
}

export function resetFoamTreeView(): void {
  void instance?.reset();
}

export function exposeFoamTreeGroup(id: string | null): void {
  if (!instance) {
    return;
  }
  if (id === null || id === "") {
    void instance.expose([]);
    return;
  }
  void instance.expose({ id });
}
