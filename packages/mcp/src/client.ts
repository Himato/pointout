import type { PointoutComment, PointoutReply, SyncSession } from '@pointout/core/format';
import type { LiveSession, Registration } from './hub/sessions';
import { HOST, tryListen, type Hub } from './hub/start';
import type { HubComment, SessionMeta } from './hub/store';
import { log } from './log';

export interface ClientOptions {
  port: number;
  home: string;
  /** Reported by `/health` when this process becomes the hub. */
  pid?: number;
}

export interface Health {
  ok: true;
  version: string;
  pid: number;
  port: number;
  home: string;
  sessions: number;
}

/** What `GET /state` and `PUT /comments` answer. */
export interface BrowserState {
  sessions: SyncSession[];
  comments: Array<{
    id: string;
    sessionId?: string;
    status?: 'open' | 'resolved';
    replies?: PointoutReply[];
  }>;
}

export type StatusFilter = 'open' | 'resolved' | 'all';

export class HubError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class PortTakenError extends Error {
  constructor(port: number) {
    super(
      `Port ${port} is used by something that is not Pointout. ` +
        'Set POINTOUT_PORT to a free port, here and in the app (server: "http://127.0.0.1:<port>").',
    );
  }
}

const LOST = new Set(['ECONNREFUSED', 'ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE']);

function lostHub(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } }).cause;
  return LOST.has(cause?.code ?? '');
}

export type HubClient = ReturnType<typeof createClient>;

/**
 * Every tool talks HTTP to the hub, even inside the hub process, so `curl` can replay anything.
 * Whoever holds the port is the hub. When it vanishes, the next request here tries to take over.
 */
export function createClient(options: ClientOptions) {
  const base = `http://${HOST}:${options.port}`;
  let hub: Hub | null = null;
  let takeover: Promise<void> | null = null;
  let onTakeover: () => Promise<void> = () => Promise.resolve();

  async function claim(): Promise<void> {
    const result = await tryListen(options);
    if (result.status === 'taken-by-other') throw new PortTakenError(options.port);
    if (result.status === 'hub') {
      hub = result.hub;
      await onTakeover();
    }
  }

  /** Becomes the hub if the port is free. Concurrent callers share one attempt. */
  function ensureHub(): Promise<void> {
    takeover ??= claim().finally(() => (takeover = null));
    return takeover;
  }

  async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
    });
    if (res.status === 204) return undefined as T;
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new HubError(res.status, data.error ?? `HTTP ${res.status}`);
    return data;
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    try {
      return await send<T>(method, path, body);
    } catch (error) {
      if (!lostHub(error)) throw error;
      log.info('hub is gone, taking over');
      await ensureHub();
      return send<T>(method, path, body);
    }
  }

  const id = (value: string) => encodeURIComponent(value);

  return {
    ensureHub,
    /** Runs after this process becomes the hub, before the failed request is retried. */
    onTakeover(fn: () => Promise<void>) {
      onTakeover = fn;
    },
    get hub(): Hub | null {
      return hub;
    },
    async close(): Promise<void> {
      await hub?.close();
      hub = null;
    },

    health: () => request<Health>('GET', '/health'),
    sessions: async () => (await request<{ sessions: LiveSession[] }>('GET', '/sessions')).sessions,
    register: (input: Registration) => request<LiveSession>('POST', '/sessions', input),
    rename: (sessionId: string, name: string) =>
      request<LiveSession>('PUT', `/sessions/${id(sessionId)}`, { name }),
    heartbeat: (sessionId: string) =>
      request<{ ok: true }>('POST', `/sessions/${id(sessionId)}/heartbeat`),
    /** Never takes over: a process on its way out should not become the hub. */
    unregister: (sessionId: string) => send<void>('DELETE', `/sessions/${id(sessionId)}`),
    sessionComments: (sessionId: string, status: StatusFilter = 'all') =>
      request<{ session: SessionMeta | null; comments: HubComment[] }>(
        'GET',
        `/sessions/${id(sessionId)}/comments?status=${status}`,
      ),
    reply: (commentId: string, text: string, from: 'claude' | 'user' = 'claude') =>
      request<HubComment>('POST', `/comments/${id(commentId)}/replies`, { from, text }),
    setStatus: (commentId: string, status: 'open' | 'resolved') =>
      request<HubComment>('PATCH', `/comments/${id(commentId)}`, { status }),
    deleteComment: (commentId: string) => request<void>('DELETE', `/comments/${id(commentId)}`),
    state: (app: string) => request<BrowserState>('GET', `/state?app=${id(app)}`),
    putComments: (body: { app: string; comments: PointoutComment[]; deleted?: string[] }) =>
      request<BrowserState>('PUT', '/comments', body),
  };
}
