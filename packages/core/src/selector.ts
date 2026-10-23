type QueryRoot = Document | ShadowRoot | Element;

const ALWAYS_GENERATED = /^(ng-|_ngcontent-|_nghost-)/;
const LIBRARY_PREFIXED = /^(cdk-|mat-)/;
// A dash or underscore separated chunk of 5+ chars mixing letters and digits: css-1x2y3z, _btn_a8f3c_1
const HASHY = /(?:^|[-_])(?=[a-z]*\d)(?=\d*[a-z])[a-z\d]{5,}(?:$|[-_])/i;

export function isGeneratedToken(token: string): boolean {
  return ALWAYS_GENERATED.test(token) || HASHY.test(token);
}

/**
 * Shortest selector that matches exactly `el` inside `scope ?? el.getRootNode()`.
 * Anchors on `#id` or `[data-testid]` when it can, otherwise tag, stable classes and
 * `:nth-of-type`, walking up only while the selector is still ambiguous.
 */
export function buildSelector(el: Element, scope?: Element | null): string {
  const scopeEl = usableScope(el, scope);
  const root: QueryRoot = scopeEl ?? (el.getRootNode() as Document | ShadowRoot);
  const unique = (selector: string) => isUniqueMatch(root, selector, el);

  let suffix = '';
  let current: Element | null = el;
  while (current) {
    const join = (segment: string) => (suffix ? `${segment} > ${suffix}` : segment);
    for (const segment of [...anchorSegments(current), ...segmentCandidates(current)]) {
      if (unique(join(segment))) return join(segment);
    }
    suffix = join(siblingUniqueSegment(current));
    if (unique(suffix)) return suffix;
    const parent: Element | null = current.parentElement;
    current = parent && parent !== scopeEl ? parent : null;
  }
  return scopeEl && unique(`:scope > ${suffix}`) ? `:scope > ${suffix}` : suffix;
}

/**
 * Document-unique selector of the element `buildSelector(el, scope)` is relative to: the scope,
 * or the shadow host. Undefined when there is neither. One shadow level only: a host that
 * itself sits inside a shadow root gets no anchor.
 */
export function buildAnchor(el: Element, scope?: Element | null): string | undefined {
  const root = el.getRootNode();
  const host = usableScope(el, scope) ?? (root instanceof ShadowRoot ? root.host : null);
  if (!host || host.getRootNode() !== el.ownerDocument) return undefined;
  return buildSelector(host);
}

function usableScope(el: Element, scope?: Element | null): Element | null {
  return scope && scope !== el && scope.contains(el) ? scope : null;
}

function anchorSegments(el: Element): string[] {
  const anchors: string[] = [];
  if (el.id && !isGeneratedToken(el.id) && !LIBRARY_PREFIXED.test(el.id)) {
    anchors.push(`#${CSS.escape(el.id)}`);
  }
  const testId = el.getAttribute('data-testid');
  if (testId) anchors.push(`[data-testid="${CSS.escape(testId)}"]`);
  return anchors;
}

function stableClasses(el: Element): string[] {
  const classes = Array.from(el.classList).filter((c) => !isGeneratedToken(c));
  const preferred = classes.filter((c) => !LIBRARY_PREFIXED.test(c));
  return (preferred.length ? preferred : classes).slice(0, 2).map((c) => `.${CSS.escape(c)}`);
}

/** Plain candidates, shortest first: `tag`, `.a`, `tag.a`, `tag.a.b`. */
function segmentCandidates(el: Element): string[] {
  const tag = CSS.escape(el.localName);
  const classes = stableClasses(el);
  const candidates = [tag, ...classes, ...classes.map((c) => tag + c)];
  if (classes.length > 1) candidates.push(tag + classes.join(''));
  return candidates.sort((a, b) => a.length - b.length);
}

/** The shortest segment that tells `el` apart from its siblings, adding `:nth-of-type` when needed. */
function siblingUniqueSegment(el: Element): string {
  const siblings = el.parentElement ? Array.from(el.parentElement.children) : [el];
  for (const segment of segmentCandidates(el)) {
    if (siblings.filter((s) => s.matches(segment)).length === 1) return segment;
  }
  const sameTag = siblings.filter((s) => s.localName === el.localName);
  return `${CSS.escape(el.localName)}:nth-of-type(${sameTag.indexOf(el) + 1})`;
}

function isUniqueMatch(root: QueryRoot, selector: string, el: Element): boolean {
  try {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === el;
  } catch {
    return false;
  }
}

/** `button.save`: the tag plus its first stable class, for labels. */
export function tagWithClass(el: Element): string {
  return el.localName + (stableClasses(el)[0] ?? '');
}
