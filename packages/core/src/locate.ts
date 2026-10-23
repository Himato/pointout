import type { PointoutComment } from './types';

/** Finds the one element a stored comment points at, through its anchor when it has one. */
export function locateComment(
  comment: Pick<PointoutComment, 'selector' | 'anchor'>,
  doc: Document = document,
): Element | null {
  if (!comment.anchor) return single(doc, comment.selector);
  const host = single(doc, comment.anchor);
  if (!host) return null;
  // Content projected into a shadow host is relative to the host itself, so try both.
  const roots = host.shadowRoot ? [host.shadowRoot, host] : [host];
  for (const root of roots) {
    const found = single(root, comment.selector);
    if (found) return found;
  }
  return null;
}

function single(root: ParentNode, selector: string): Element | null {
  try {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 ? (matches[0] ?? null) : null;
  } catch {
    return null;
  }
}
