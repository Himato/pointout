import type { PointoutComment, StorageMode } from './types';

export interface CommentStore {
  load(): PointoutComment[];
  save(comments: PointoutComment[]): void;
  clear(): void;
}

export function storageKey(appName: string): string {
  return `pointout:${appName}`;
}

export function createCommentStore(appName: string, mode: StorageMode): CommentStore {
  const key = storageKey(appName);
  // Reading `sessionStorage` itself throws in sandboxed iframes, so stay lazy and guarded.
  const backend = (): Storage | null => {
    try {
      if (mode === 'session') return globalThis.sessionStorage ?? null;
      if (mode === 'local') return globalThis.localStorage ?? null;
    } catch {
      /* storage blocked */
    }
    return null;
  };

  return {
    load() {
      try {
        const parsed: unknown = JSON.parse(backend()?.getItem(key) ?? '[]');
        return Array.isArray(parsed) ? (parsed as PointoutComment[]) : [];
      } catch {
        return [];
      }
    },
    save(comments) {
      try {
        backend()?.setItem(key, JSON.stringify(comments));
      } catch {
        // Screenshots are what blow the quota. Keep the words, the in-memory copy keeps the rest.
        try {
          backend()?.setItem(key, JSON.stringify(comments.map(withoutScreenshot)));
        } catch {
          /* storage blocked */
        }
      }
    },
    clear() {
      try {
        backend()?.removeItem(key);
      } catch {
        /* nothing to clear */
      }
    },
  };
}

function withoutScreenshot(comment: PointoutComment): PointoutComment {
  const copy = { ...comment };
  delete copy.screenshotDataUrl;
  return copy;
}
