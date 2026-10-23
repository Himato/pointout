import type { PointoutComment } from './types';

/** What the hub owns about a comment, plus the id that ties it to ours. */
export type HubRecord = Pick<PointoutComment, 'id' | 'sessionId' | 'status' | 'replies'>;

export interface MergeResult {
  comments: PointoutComment[];
  /** One toast for the whole merge, or null when nothing worth saying happened. */
  flash: string | null;
}

export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Plain http on a LAN address is not a secure context, so randomUUID is missing there.
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

/** Comments stored before ids existed get one. Returns the same array when nothing was missing. */
export function withIds(comments: PointoutComment[]): PointoutComment[] {
  if (comments.every((c) => typeof c.id === 'string' && c.id)) return comments;
  return comments.map((c) => (typeof c.id === 'string' && c.id ? c : { ...c, id: newId() }));
}

/** Folds the hub's fields into ours by id. Null when nothing changed. */
export function mergeRecords(
  comments: PointoutComment[],
  records: HubRecord[],
): MergeResult | null {
  const byId = new Map(records.map((r) => [r.id, r]));
  let changed = false;
  let replied = false;
  let resolved = false;

  const merged = comments.map((comment) => {
    const record = byId.get(comment.id);
    if (!record) return comment;
    const next: PointoutComment = { ...comment, sessionId: record.sessionId ?? comment.sessionId };
    if (record.status) next.status = record.status;
    else delete next.status;
    if (record.replies?.length) next.replies = record.replies;
    else delete next.replies;
    if (!next.sessionId) delete next.sessionId;

    if (hubKey(next) === hubKey(comment)) return comment;
    changed = true;
    replied ||= (next.replies?.length ?? 0) > (comment.replies?.length ?? 0);
    resolved ||= next.status === 'resolved' && comment.status !== 'resolved';
    return next;
  });

  if (!changed) return null;
  const flash = resolved ? 'Resolved by Claude' : replied ? 'Claude replied' : null;
  return { comments: merged, flash };
}

function hubKey(c: PointoutComment): string {
  return JSON.stringify([c.sessionId ?? null, c.status ?? 'open', c.replies ?? []]);
}
