import {
  defaultFormatter,
  ownerLabel,
  type PointoutBundle,
  type PointoutComment,
} from '@pointout/core/format';
import type { HubComment } from './hub/store';

/** Drops the hub's `app` so the comment reads exactly like the browser's own. */
export function toComment(comment: HubComment): PointoutComment {
  const copy: Omit<HubComment, 'app'> & { app?: string } = { ...comment };
  delete copy.app;
  return copy;
}

/** The same text Copy for Claude puts on the clipboard for these comments. */
export function brief(comments: HubComment[], fallbackName: string, now = new Date()): string {
  const first = comments[0];
  const bundle: PointoutBundle = {
    appName: first?.app ?? fallbackName,
    createdAt: now.toISOString(),
    viewport: first?.viewport ?? { w: 0, h: 0, colorScheme: 'light' },
    comments: comments.map(toComment),
  };
  return defaultFormatter(bundle);
}

/** `Component (file) › selector`, the way the brief names an element. */
export function label(comment: PointoutComment): string {
  const file = comment.owner?.file ? ` (${comment.owner.file})` : '';
  return `${ownerLabel(comment.owner, comment.domOwner)}${file} › ${comment.selector}`;
}

/** What Claude needs to act on a comment, without the screenshot and geometry. */
export function compact(comment: PointoutComment) {
  return {
    id: comment.id,
    n: comment.n,
    status: comment.status ?? 'open',
    label: label(comment),
    url: comment.url,
    text: comment.text,
    comment: comment.comment,
    replies: comment.replies ?? [],
  };
}
