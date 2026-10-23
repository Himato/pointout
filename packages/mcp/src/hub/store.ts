import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { PointoutComment } from '@pointout/core/format';
import { log } from '../log';

export type HubComment = PointoutComment & { app: string };

export interface SessionMeta {
  id: string;
  name: string;
  project: string;
  startedAt: string;
  endedAt?: string;
}

export interface SessionFile {
  version: 1;
  session: SessionMeta | null;
  comments: HubComment[];
}

/** Where a file lives: `<home>/<project>/<name>.json`. */
export interface FileRef {
  project: string;
  name: string;
}

export interface Located {
  file: FileRef;
  comment: HubComment;
}

export const UNASSIGNED = '_unassigned';
const SAFE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,63}$/;

export function isSafeName(name: unknown): name is string {
  return typeof name === 'string' && SAFE.test(name);
}

const empty = (): SessionFile => ({ version: 1, session: null, comments: [] });
const sameFile = (a: FileRef, b: FileRef) => a.project === b.project && a.name === b.name;

export type Store = ReturnType<typeof createStore>;

/** Session files on disk. Synchronous on purpose: they are small and the hub is the only writer. */
export function createStore(home: string) {
  function path(ref: FileRef): string {
    if (!isSafeName(ref.project) || !isSafeName(ref.name)) {
      throw new Error(`Unsafe file name ${ref.project}/${ref.name}`);
    }
    return join(home, ref.project, `${ref.name}.json`);
  }

  function readSession(ref: FileRef): SessionFile {
    const file = path(ref);
    if (!existsSync(file)) return empty();
    try {
      const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<SessionFile>;
      return {
        version: 1,
        session: data.session ?? null,
        comments: Array.isArray(data.comments) ? data.comments : [],
      };
    } catch (error) {
      log.warn(`ignoring unreadable ${file}: ${(error as Error).message}`);
      return empty();
    }
  }

  // Write next to the target, then rename: a crash leaves the old file or the new one, never half.
  function writeSession(ref: FileRef, data: SessionFile): void {
    const file = path(ref);
    mkdirSync(join(home, ref.project), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
    renameSync(tmp, file);
  }

  function listSessionFiles(project?: string): FileRef[] {
    const projects = project ? [project] : dirs(home);
    return projects.flatMap((p) =>
      files(join(home, p))
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ project: p, name: f.slice(0, -'.json'.length) }))
        .filter((ref) => isSafeName(ref.name)),
    );
  }

  /** The file of a session id, in whatever project it was registered. */
  function locateSession(id: string): FileRef | null {
    if (!isSafeName(id) || id === UNASSIGNED) return null;
    return listSessionFiles().find((ref) => ref.name === id) ?? null;
  }

  function allComments(): Located[] {
    return listSessionFiles().flatMap((file) =>
      readSession(file).comments.map((comment) => ({ file, comment })),
    );
  }

  function findComment(id: string): Located | null {
    return allComments().find((l) => l.comment.id === id) ?? null;
  }

  function commentsForApp(app: string): HubComment[] {
    return allComments()
      .map((l) => l.comment)
      .filter((c) => c.app === app);
  }

  /** Loads files once, lets `fn` edit them, then writes only the ones it touched. */
  function edit(fn: (open: (ref: FileRef) => SessionFile, touch: (ref: FileRef) => void) => void) {
    const cache = new Map<string, { ref: FileRef; data: SessionFile; dirty: boolean }>();
    const entry = (ref: FileRef) => {
      const key = path(ref);
      let hit = cache.get(key);
      if (!hit) cache.set(key, (hit = { ref, data: readSession(ref), dirty: false }));
      return hit;
    };
    fn(
      (ref) => entry(ref).data,
      (ref) => (entry(ref).dirty = true),
    );
    for (const { ref, data, dirty } of cache.values()) if (dirty) writeSession(ref, data);
  }

  /**
   * Upserts by id, moving each comment to the file of its `sessionId`. `fallbackProject` hosts the
   * unassigned file when a comment has no session and no previous home.
   */
  function upsertComments(comments: HubComment[], fallbackProject = UNASSIGNED): HubComment[] {
    const where = new Map(allComments().map((l) => [l.comment.id, l.file]));
    const saved: HubComment[] = [];
    edit((open, touch) => {
      for (const comment of comments) {
        const from = where.get(comment.id);
        const to = (comment.sessionId && locateSession(comment.sessionId)) || {
          project: from?.project ?? fallbackProject,
          name: UNASSIGNED,
        };
        if (from && !sameFile(from, to)) {
          const old = open(from);
          old.comments = old.comments.filter((c) => c.id !== comment.id);
          touch(from);
        }
        const target = open(to);
        const index = target.comments.findIndex((c) => c.id === comment.id);
        if (index === -1) target.comments.push(comment);
        else target.comments[index] = comment;
        touch(to);
        where.set(comment.id, to);
        saved.push(comment);
      }
    });
    return saved;
  }

  /** Removes these ids wherever they live. `app`, when given, guards against foreign ids. */
  function deleteComments(ids: string[], app?: string): number {
    const doomed = new Set(ids);
    let removed = 0;
    edit((open, touch) => {
      for (const { file, comment } of allComments()) {
        if (!doomed.has(comment.id) || (app !== undefined && comment.app !== app)) continue;
        const data = open(file);
        data.comments = data.comments.filter((c) => c.id !== comment.id);
        touch(file);
        removed++;
      }
    });
    return removed;
  }

  /** Applies `fn` to one stored comment and saves it. Null when the id is unknown. */
  function updateComment(id: string, fn: (comment: HubComment) => HubComment): HubComment | null {
    const found = findComment(id);
    if (!found) return null;
    let next: HubComment | null = null;
    edit((open, touch) => {
      const data = open(found.file);
      data.comments = data.comments.map((c) => (c.id === id ? (next = fn(c)) : c));
      touch(found.file);
    });
    return next;
  }

  return {
    home,
    readSession,
    writeSession,
    listSessionFiles,
    locateSession,
    findComment,
    commentsForApp,
    upsertComments,
    deleteComments,
    updateComment,
  };
}

function dirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && isSafeName(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function files(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
