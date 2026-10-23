import { collapseText, parentOrHost } from './dom';
import { buildSelector } from './selector';
import type { DomOwnerInfo } from './types';

type Marker = DomOwnerInfo['marker'];
type Boundary = { el: Element; marker: Marker; name: string };

const OWN_TAG = 'point-out';
const LANDMARKS = new Set([
  'main',
  'nav',
  'aside',
  'header',
  'footer',
  'form',
  'section',
  'article',
]);
const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/** Finds the nearest framework-neutral boundary above `el` and describes where `el` sits in it. */
export function resolveDomOwner(el: Element): DomOwnerInfo {
  const boundary = findBoundary(el);
  const heading = findHeading(el, boundary?.el ?? null);
  const scope = boundary?.el.contains(el) ? boundary.el : undefined;
  return {
    tag: boundary?.el.localName ?? 'html',
    marker: boundary?.marker ?? 'document',
    name: boundary?.name ?? 'document',
    ...(heading ? { heading } : {}),
    path: buildSelector(el, scope),
  };
}

function findBoundary(el: Element): Boundary | null {
  for (let node = parentOrHost(el); node; node = parentOrHost(node)) {
    if (node.localName === OWN_TAG) continue;
    const match = matchMarker(node);
    if (match) return { el: node, ...match };
  }
  return null;
}

function matchMarker(el: Element): Omit<Boundary, 'el'> | null {
  const component = el.getAttribute('data-component');
  if (component) return { marker: 'data-component', name: component };

  const testId = el.getAttribute('data-testid');
  if (testId) return { marker: 'data-testid', name: testId };

  if (el.localName.includes('-')) return { marker: 'custom-element', name: el.localName };

  if (hasHostAttribute(el)) return { marker: 'host-attr', name: el.localName };

  const label = el.id || el.getAttribute('aria-label');
  if (label && (LANDMARKS.has(el.localName) || el.hasAttribute('role'))) {
    return { marker: 'landmark', name: label };
  }
  return null;
}

function hasHostAttribute(el: Element): boolean {
  return el
    .getAttributeNames()
    .some(
      (name) =>
        name.startsWith('_nghost-') ||
        name.startsWith('data-v-') ||
        name === 'ng-version' ||
        name === 'data-reactroot',
    );
}

/** Closest heading that sits before `el` in reading order, without leaving the boundary. */
function findHeading(el: Element, boundary: Element | null): string | undefined {
  for (let node: Element | null = el; node && node !== boundary; node = parentOrHost(node)) {
    if (node.matches(HEADING_SELECTOR)) return headingText(node);
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.matches(HEADING_SELECTOR)) return headingText(sib);
      const inner = Array.from(sib.querySelectorAll(HEADING_SELECTOR)).pop();
      if (inner) return headingText(inner);
    }
  }
  return collapseText(boundary?.getAttribute('aria-label')) || undefined;
}

function headingText(el: Element): string | undefined {
  return collapseText(el.textContent) || undefined;
}
