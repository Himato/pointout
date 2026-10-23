export function collapseText(value: string | null | undefined, max = 80): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Next element up the tree, stepping out of shadow roots through their host. */
export function parentOrHost(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

/** Runs `tick` every animation frame until the returned stop function is called. */
export function everyFrame(tick: () => void): () => void {
  let id = 0;
  const loop = () => {
    tick();
    id = requestAnimationFrame(loop);
  };
  id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}
