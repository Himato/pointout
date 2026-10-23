import type { SelectMode } from './types';

export interface HitTestOptions {
  /** Our own `<point-out>` element. Events that pass through it are never ours to take. */
  host: Element;
  mode: () => SelectMode;
  onHover: (el: Element | null) => void;
  onSelect: (el: Element) => void;
}

const SWALLOWED = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'] as const;

/** The real element under the pointer, even inside open shadow roots, or null for our own UI. */
export function pageTarget(event: Event, host: Element): Element | null {
  const path = event.composedPath();
  if (path.includes(host)) return null;
  const first = path[0] ?? event.target;
  if (first instanceof Element) return first;
  return first instanceof Node ? first.parentElement : null;
}

/** Captures pointer events on `window` before the page sees them. Returns a detach function. */
export function attachHitTest({ host, mode, onHover, onSelect }: HitTestOptions): () => void {
  const isSelecting = (event: MouseEvent) => mode() === 'intercept' || event.altKey;

  const onMove = (event: Event) => onHover(pageTarget(event, host));
  const onLeave = (event: MouseEvent) => {
    if (!event.relatedTarget) onHover(null);
  };
  const onPress = (event: Event) => {
    const mouse = event as MouseEvent;
    const target = pageTarget(event, host);
    if (!target || !isSelecting(mouse)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'click') onSelect(target);
  };

  const capture = { capture: true } as const;
  window.addEventListener('pointermove', onMove, capture);
  window.addEventListener('mouseout', onLeave, capture);
  for (const type of SWALLOWED) window.addEventListener(type, onPress, capture);

  return () => {
    window.removeEventListener('pointermove', onMove, capture);
    window.removeEventListener('mouseout', onLeave, capture);
    for (const type of SWALLOWED) window.removeEventListener(type, onPress, capture);
  };
}
