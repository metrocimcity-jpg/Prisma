let pendingSearchFocus = false;

export function focusSidebarSearch(): void {
  pendingSearchFocus = true;
  window.dispatchEvent(new Event("prisma-focus-search"));
}

export function consumeSidebarSearchFocus(): boolean {
  if (!pendingSearchFocus) {
    return false;
  }
  pendingSearchFocus = false;
  return true;
}
