import type { SessionMeta, Store } from './store';

export interface LiveSession {
  id: string;
  name: string;
  project: string;
  pid: number;
  startedAt: string;
  lastSeen: number;
}

export interface Registration {
  id: string;
  name: string;
  project: string;
  pid: number;
}

export const EXPIRE_MS = 30_000;
const SWEEP_MS = 10_000;

export type Sessions = ReturnType<typeof createSessions>;

/** Who is alive right now. Memory only: after a takeover it refills from heartbeats. */
export function createSessions(store: Store, now: () => number = Date.now) {
  const registry = new Map<string, LiveSession>();
  let timer: ReturnType<typeof setInterval> | undefined;

  function saveMeta(id: string, project: string, patch: (meta: SessionMeta) => SessionMeta): void {
    const ref = { project, name: id };
    const data = store.readSession(ref);
    const base = data.session ?? {
      id,
      name: id,
      project,
      startedAt: new Date(now()).toISOString(),
    };
    store.writeSession(ref, { ...data, session: patch(base) });
  }

  function register(input: Registration): LiveSession {
    const existing = registry.get(input.id);
    let startedAt = existing?.startedAt ?? '';
    saveMeta(input.id, input.project, (meta) => {
      startedAt ||= meta.startedAt;
      const next: SessionMeta = { ...meta, name: input.name, project: input.project };
      delete next.endedAt;
      return next;
    });
    const session: LiveSession = { ...input, startedAt, lastSeen: now() };
    registry.set(input.id, session);
    return session;
  }

  function heartbeat(id: string): boolean {
    const session = registry.get(id);
    if (session) session.lastSeen = now();
    return session !== undefined;
  }

  function rename(id: string, name: string): LiveSession | null {
    const session = registry.get(id);
    if (!session) return null;
    session.name = name;
    saveMeta(id, session.project, (meta) => ({ ...meta, name }));
    return session;
  }

  function end(session: LiveSession): void {
    registry.delete(session.id);
    saveMeta(session.id, session.project, (meta) => ({
      ...meta,
      endedAt: new Date(now()).toISOString(),
    }));
  }

  function unregister(id: string): boolean {
    const session = registry.get(id);
    if (session) end(session);
    return session !== undefined;
  }

  const isLive = (s: LiveSession) => now() - s.lastSeen <= EXPIRE_MS;

  function live(): LiveSession[] {
    return [...registry.values()].filter(isLive);
  }

  function sweep(): void {
    for (const session of registry.values()) if (!isLive(session)) end(session);
  }

  return {
    register,
    heartbeat,
    rename,
    unregister,
    live,
    sweep,
    get: (id: string) => {
      const session = registry.get(id);
      return session && isLive(session) ? session : undefined;
    },
    start() {
      timer ??= setInterval(sweep, SWEEP_MS);
      timer.unref();
    },
    stop() {
      clearInterval(timer);
      timer = undefined;
    },
  };
}
