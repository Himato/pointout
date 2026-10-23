import type { DomOwnerInfo, ExportFormatter, PointoutComment } from './types';

const CLOSING_NOTE =
  'Resolve each item in the component named; the selector is relative to that component. ' +
  'Ask before changing anything outside those components.';

/** `AlertsTableComponent`, or `<section "SLA breach alerts">` when no adapter named the owner. */
export function ownerLabel(owner: PointoutComment['owner'], domOwner: DomOwnerInfo): string {
  if (owner?.component) return owner.component;
  return `<${domOwner.tag} "${domOwner.heading ?? domOwner.name}">`;
}

/** `Component (file) › selector`, the way the brief names an element. */
export function commentLabel(comment: PointoutComment): string {
  const file = comment.owner?.file ? ` (${comment.owner.file})` : '';
  return `${ownerLabel(comment.owner, comment.domOwner)}${file} › ${comment.selector}`;
}

/**
 * A short brief per open comment, the closing note, then the whole bundle as fenced JSON.
 * Screenshots stay out: a data URL is noise in a text brief. The .json download keeps them.
 */
export const defaultFormatter: ExportFormatter = (bundle) => {
  const { appName, createdAt, viewport, comments } = bundle;
  const open = comments.filter((c) => c.status !== 'resolved');
  const resolved = comments.length - open.length;
  const counts = resolved ? `${open.length} open, ${resolved} resolved` : `${open.length} items`;
  const items = open.map((c) => {
    const quote = c.text ? ` — "${c.text}"` : '';
    const head = `${c.n}. [${commentLabel(c)}] on ${c.url}${quote}`;
    const body = c.comment
      .split('\n')
      .map((line) => `   ${line}`)
      .join('\n');
    return `${head}\n${body}`;
  });

  return [
    `Pointout on ${appName} — ${createdAt}`,
    `${counts}, viewport ${viewport.w}×${viewport.h}, ${viewport.colorScheme}`,
    '',
    ...items,
    '',
    CLOSING_NOTE,
    '',
    '```json',
    JSON.stringify({ ...bundle, comments: comments.map(withoutScreenshot) }, null, 2),
    '```',
  ].join('\n');
};

function withoutScreenshot(comment: PointoutComment): PointoutComment {
  const copy = { ...comment };
  delete copy.screenshotDataUrl;
  return copy;
}
