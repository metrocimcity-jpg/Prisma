let pendingSearchFocus = false;

export interface ChartFileGlance {
  id: string;
  name: string;
  extension: string;
  discipline: string;
  version: number;
  sizeMb: number;
  dateLabel: string;
}

export function focusSidebarSearch(): void {
  pendingSearchFocus = true;
  window.dispatchEvent(new Event("prisma-focus-search"));
}

export function focusSidebarOverview(glance: ChartFileGlance): void {
  window.dispatchEvent(new CustomEvent("prisma-focus-overview", { detail: glance }));
}

export function subscribeSidebarOverview(listener: (glance: ChartFileGlance) => void): () => void {
  const onOverview = (event: Event): void => {
    listener((event as CustomEvent<ChartFileGlance>).detail);
  };
  window.addEventListener("prisma-focus-overview", onOverview);
  return () => window.removeEventListener("prisma-focus-overview", onOverview);
}

export function consumeSidebarSearchFocus(): boolean {
  if (!pendingSearchFocus) {
    return false;
  }
  pendingSearchFocus = false;
  return true;
}
