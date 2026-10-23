import { collapseText } from './dom';
import { resolveDomOwner } from './dom-owner';
import { buildAnchor, buildSelector } from './selector';
import type { OwnerInfo, OwnerResolver, PointoutComment } from './types';

export type Viewport = PointoutComment['viewport'];
export type Capture = Omit<PointoutComment, 'n' | 'comment' | 'createdAt' | 'screenshotDataUrl'>;

/** Wraps an adapter so a throw becomes `null` and one warning, never a broken page. */
export function guardResolver(
  resolver: OwnerResolver | undefined,
): (el: Element) => OwnerInfo | null {
  let warned = false;
  return (el) => {
    if (!resolver) return null;
    try {
      return resolver(el) ?? null;
    } catch (error) {
      if (!warned) {
        warned = true;
        console.warn('[pointout] resolveOwner threw, falling back to DOM info.', error);
      }
      return null;
    }
  };
}

export function defaultUrl(): string {
  const { pathname, search, hash } = globalThis.location;
  return pathname + search + hash;
}

export function readViewport(): Viewport {
  return { w: window.innerWidth, h: window.innerHeight, colorScheme: readColorScheme() };
}

/** The page's own `color-scheme` wins over the OS preference when it picks one side. */
function readColorScheme(): 'light' | 'dark' {
  const declared = getComputedStyle(document.documentElement).colorScheme ?? '';
  const hasDark = /\bdark\b/.test(declared);
  const hasLight = /\blight\b/.test(declared);
  if (hasDark !== hasLight) return hasDark ? 'dark' : 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function captureElement(el: Element, owner: OwnerInfo | null, url: string): Capture {
  const rect = el.getBoundingClientRect();
  const anchor = buildAnchor(el, owner?.scope);
  return {
    url,
    owner: owner ? storableOwner(owner) : null,
    domOwner: resolveDomOwner(el),
    selector: buildSelector(el, owner?.scope),
    ...(anchor && { anchor }),
    tag: el.localName,
    text: collapseText(el.textContent),
    bbox: {
      x: Math.round(rect.left + window.scrollX),
      y: Math.round(rect.top + window.scrollY),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
    viewport: readViewport(),
  };
}

/** Drops `scope` and anything in `props` that would not survive JSON. */
function storableOwner(owner: OwnerInfo): Omit<OwnerInfo, 'scope'> {
  const stored: OwnerInfo = { ...owner };
  delete stored.scope;
  if (stored.props) {
    try {
      stored.props = JSON.parse(JSON.stringify(stored.props)) as Record<string, unknown>;
    } catch {
      delete stored.props;
    }
  }
  return stored;
}
