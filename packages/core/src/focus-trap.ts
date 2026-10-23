/** The focused element, looking inside shadow roots, so focus can go back to a badge. */
export function deepActiveElement(): HTMLElement | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement ? active : null;
}

/** Keeps Tab and Shift+Tab cycling through `stops`, so focus never leaves a dialog. */
export function trapTab(event: KeyboardEvent, stops: HTMLElement[]): void {
  event.preventDefault();
  const visible = stops.filter((stop) => !stop.hidden);
  if (!visible.length) return;
  const root = visible[0]!.getRootNode() as Document | ShadowRoot;
  const index = visible.indexOf(root.activeElement as HTMLElement);
  const step = event.shiftKey ? -1 : 1;
  const next = index < 0 ? (step > 0 ? 0 : visible.length - 1) : index + step;
  visible[(next + visible.length) % visible.length]?.focus();
}
