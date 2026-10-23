import type { HubRecord } from './merge';
import type { PointoutComment, SyncSession, SyncState } from './types';

export const DEFAULT_HUB = 'http://127.0.0.1:7331';
const POLL_MS = 3_000;
const RETRY_MS = 30_000;
const PUSH_DEBOUNCE_MS = 300;
const TIMEOUT_MS = 2_000;

export interface SyncDeps {
  url: string;
  app: string;
  getComments(): PointoutComment[];
  onState(state: SyncState, sessions: SyncSession[], target: SyncSession | null): void;
  onMerge(records: HubRecord[]): void;
  /** For tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch;
}

export interface Sync {
  start(): void;
  stop(): void;
  push(): void;
  setSession(id: string): void;
  readonly target: SyncSession | null;
  readonly sessions: SyncSession[];
}

/** What `GET /state` and `PUT /comments` both answer with. */
interface HubState {
  sessions: SyncSession[];
  comments: HubRecord[];
}

/** `true` means the default hub. A string is the hub's base URL. */
export function hubUrl(server: boolean | string): string {
  return (server === true ? DEFAULT_HUB : String(server)).replace(/\/+$/, '');
}

/** Talks to the local hub. Never throws: a failure is just `offline` and a slower retry. */
export function createSync(deps: SyncDeps): Sync {
  const http = deps.fetch ?? ((input, init) => globalThis.fetch(input, init));
  let state: SyncState = 'off';
  let sessions: SyncSession[] = [];
  let target: SyncSession | null = null;
  let picked: string | null = null;
  let stateKey = '';
  let known = new Set<string>();

  let running = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  let pushing = 0;
  // A push that failed, or the first contact, may leave the hub behind us.
  let behind = false;
  let contacted = false;

  function emit(next: SyncState): void {
    if (next !== state) {
      console.info(
        next === 'connected'
          ? `[pointout] hub connected at ${deps.url}`
          : '[pointout] hub offline, will retry',
      );
    }
    state = next;
    const key = JSON.stringify([state, sessions, target?.id ?? null]);
    if (key === stateKey) return;
    stateKey = key;
    deps.onState(state, sessions, target);
  }

  function pickTarget(): SyncSession | null {
    const chosen = sessions.find((s) => s.id === picked);
    if (chosen) return chosen;
    picked = null;
    return sessions.length === 1 ? (sessions[0] ?? null) : null;
  }

  async function request(path: string, init?: RequestInit): Promise<HubState | null> {
    try {
      const response = await http(deps.url + path, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as Partial<HubState> | null;
      return {
        sessions: Array.isArray(body?.sessions) ? body.sessions : [],
        comments: Array.isArray(body?.comments) ? body.comments : [],
      };
    } catch {
      sessions = [];
      target = null;
      emit('offline');
      return null;
    }
  }

  /** Local edits waiting to go out win over whatever the hub said before it saw them. */
  function apply(body: HubState): void {
    const hadTarget = target !== null;
    sessions = body.sessions;
    known = new Set(body.comments.map((c) => c.id));
    target = pickTarget();
    emit('connected');

    if (pushTimer === undefined && pushing === 0) {
      deps.onMerge(
        body.comments.map(({ id, sessionId, status, replies }) => ({
          id,
          sessionId,
          status,
          replies,
        })),
      );
    }

    const firstContact = !contacted;
    contacted = true;
    const local = deps.getComments();
    if (behind || (firstContact && local.some((c) => !known.has(c.id)))) push();
    else if (!hadTarget) pushIfUnassigned();
  }

  function pushIfUnassigned(): void {
    if (target && deps.getComments().some((c) => !c.sessionId)) push();
  }

  function schedule(ms: number): void {
    clearTimeout(pollTimer);
    pollTimer = running ? setTimeout(() => void poll(), ms) : undefined;
  }

  async function poll(): Promise<void> {
    const body = await request(`/state?app=${encodeURIComponent(deps.app)}`);
    if (body) apply(body);
    schedule(body ? POLL_MS : RETRY_MS);
  }

  async function send(): Promise<void> {
    clearTimeout(pushTimer);
    pushTimer = undefined;
    behind = false;
    const comments = deps.getComments().map((comment) => {
      const out = { ...comment };
      if (!out.sessionId && target) out.sessionId = target.id;
      if (known.has(out.id)) delete out.screenshotDataUrl;
      return out;
    });
    pushing++;
    const body = await request('/comments', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ app: deps.app, comments }),
    });
    pushing--;
    if (body) apply(body);
    else behind = true;
  }

  function push(): void {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void send(), PUSH_DEBOUNCE_MS);
  }

  return {
    start() {
      if (running) return;
      running = true;
      void poll();
    },
    stop() {
      running = false;
      clearTimeout(pollTimer);
      pollTimer = undefined;
      // Do not drop an edit that was about to go out.
      if (pushTimer !== undefined) void send();
    },
    push,
    setSession(id) {
      const hadTarget = target !== null;
      picked = id;
      target = pickTarget();
      emit(state);
      if (!hadTarget) pushIfUnassigned();
    },
    get target() {
      return target;
    },
    get sessions() {
      return sessions;
    },
  };
}
