import type { DomOwnerInfo, ExportFormatter, PointoutComment } from './types';

const CLOSING_NOTE =
  'Resolve each item in the component named; the selector is relative to that component. ' +
  'Ask before changing anything outside those components.';

/** `AlertsTableComponent`, or `<section "SLA breach alerts">` when no adapter named the owner. */
export function ownerLabel(owner: PointoutComment['owner'], domOwner: DomOwnerInfo): string {
  if (owner?.component) return owner.component;
  return `<${domOwner.tag} "${domOwner.heading ?? domOwner.name}">`;
}

export const defaultFormatter: ExportFormatter = (bundle) => {
  const { appName, createdAt, viewport, comments } = bundle;
  const items = comments.map((c) => {
    const file = c.owner?.file ? ` (${c.owner.file})` : '';
    const quote = c.text ? ` — "${c.text}"` : '';
    const head = `${c.n}. [${ownerLabel(c.owner, c.domOwner)}${file} › ${c.selector}] on ${c.url}${quote}`;
    const body = c.comment
      .split('\n')
      .map((line) => `   ${line}`)
      .join('\n');
    return `${head}\n${body}`;
  });

  return [
    `Pointout on ${appName} — ${createdAt}`,
    `${comments.length} items, viewport ${viewport.w}×${viewport.h}, ${viewport.colorScheme}`,
    '',
    ...items,
    '',
    CLOSING_NOTE,
    '',
    '```json',
    JSON.stringify(bundle, null, 2),
    '```',
  ].join('\n');
};
