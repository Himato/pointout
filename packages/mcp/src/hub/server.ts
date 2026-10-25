import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { PointoutComment } from '@point-out/core/format';
import { VERSION } from '../version';
import {
  HttpError,
  hostnameOf,
  isLocalHost,
  readJson,
  sendEmpty,
  sendJson,
  sendText,
} from './http';
import type { Registration, Sessions } from './sessions';
import { isSafeName, UNASSIGNED, type HubComment, type Store } from './store';

export interface HubContext {
  store: Store;
  sessions: Sessions;
  /** The port actually bound, for `/health`. Read lazily because port 0 resolves on listen. */
  port(): number;
  pid: number;
}

interface Request {
  req: IncomingMessage;
  url: URL;
  params: string[];
}

type Handler = (ctx: HubContext, request: Request, res: ServerResponse) => Promise<void> | void;

interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  handler: Handler;
  about: string;
}

const routes: Route[] = [];

function route(method: string, path: string, about: string, handler: Handler): void {
  const pattern = new RegExp(`^${path.replace(/:[a-z]+/g, '([^/]+)')}$`);
  routes.push({ method, path, pattern, handler, about });
}

const METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

export function createHubServer(ctx: HubContext): Server {
  return createServer((req, res) => {
    void handle(ctx, req, res).catch((error: unknown) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (!res.headersSent) sendJson(res, status, { error: (error as Error).message });
      else res.end();
    });
  });
}

async function handle(ctx: HubContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  // A page on any other origin, or a rebound DNS name, never gets in. Local dev pages do.
  const host = hostnameOf(req.headers.host ?? '', false);
  if (!host || !isLocalHost(host)) throw new HttpError(403, 'Host not allowed');
  const origin = req.headers.origin;
  if (origin !== undefined) {
    const originHost = hostnameOf(origin, true);
    if (!originHost || !isLocalHost(originHost)) throw new HttpError(403, 'Origin not allowed');
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-methods', METHODS);
    res.setHeader('access-control-allow-headers', 'content-type');
    res.setHeader('access-control-max-age', '600');
    return sendEmpty(res);
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  for (const r of routes) {
    const match = r.method === req.method ? r.pattern.exec(url.pathname) : null;
    if (match) {
      const params = match.slice(1).map((p) => decodeURIComponent(p));
      return r.handler(ctx, { req, url, params }, res);
    }
  }
  throw new HttpError(404, `No route for ${req.method} ${url.pathname}`);
}

// Small readers that turn bad input into a 400.

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Expected a JSON object');
  }
  return value as Record<string, unknown>;
}

function text(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `"${key}" is required`);
  return value;
}

function found<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new HttpError(404, `${what} not found`);
  return value;
}

/** What the browser sees: live sessions, and the hub owned fields of every comment of its app. */
function state(ctx: HubContext, app: string) {
  return {
    sessions: ctx.sessions.live().map(({ id, name, project }) => ({ id, name, project })),
    comments: ctx.store
      .commentsForApp(app)
      .map(({ id, sessionId, status, replies }) => ({ id, sessionId, status, replies })),
  };
}

/** The browser owns the comment, the hub owns `status` and `replies`. A sent status is a click. */
function fromBrowser(input: PointoutComment, stored: HubComment | undefined, app: string) {
  const next: HubComment = { ...input, app };
  delete next.status;
  delete next.replies;
  if (!next.screenshotDataUrl && stored?.screenshotDataUrl) {
    next.screenshotDataUrl = stored.screenshotDataUrl;
  }
  if ((input.status ?? stored?.status) === 'resolved') next.status = 'resolved';
  if (stored?.replies?.length) next.replies = stored.replies;
  return next;
}

/** Unassigned comments sit with the live sessions when they all share one project. */
function fallbackProject(ctx: HubContext): string {
  const projects = new Set(ctx.sessions.live().map((s) => s.project));
  return projects.size === 1 ? [...projects][0]! : UNASSIGNED;
}

function setStatus(comment: HubComment, status: 'open' | 'resolved'): HubComment {
  const next = { ...comment };
  if (status === 'resolved') next.status = 'resolved';
  else delete next.status;
  return next;
}

route('GET', '/', 'this page', (ctx, _request, res) => {
  const lines = routes.map((r) => `  ${r.method.padEnd(6)} ${r.path.padEnd(28)} ${r.about}`);
  sendText(
    res,
    200,
    [
      `Pointout hub ${VERSION}, pid ${ctx.pid}, port ${ctx.port()}`,
      `Store: ${ctx.store.home}`,
      '',
      ...lines,
      '',
      'Local dev data, no auth, 127.0.0.1 only.',
      '',
    ].join('\n'),
  );
});

route('GET', '/health', 'who is the hub', (ctx, _request, res) => {
  sendJson(res, 200, {
    ok: true,
    version: VERSION,
    pid: ctx.pid,
    port: ctx.port(),
    home: ctx.store.home,
    sessions: ctx.sessions.live().length,
  });
});

route('GET', '/sessions', 'live sessions', (ctx, _request, res) => {
  sendJson(res, 200, { sessions: ctx.sessions.live() });
});

route('POST', '/sessions', 'register { id, name, project, pid }', async (ctx, { req }, res) => {
  const body = object(await readJson(req));
  const registration: Registration = {
    id: text(body, 'id'),
    name: text(body, 'name'),
    project: text(body, 'project'),
    pid: typeof body.pid === 'number' ? body.pid : 0,
  };
  if (!isSafeName(registration.id) || !isSafeName(registration.project)) {
    throw new HttpError(400, 'id and project must match [A-Za-z0-9._-]');
  }
  sendJson(res, 201, ctx.sessions.register(registration));
});

route('PUT', '/sessions/:id', 'rename { name }', async (ctx, { req, params }, res) => {
  const name = text(object(await readJson(req)), 'name');
  sendJson(res, 200, found(ctx.sessions.rename(params[0]!, name), 'Session'));
});

route('POST', '/sessions/:id/heartbeat', 'still here', (ctx, { params }, res) => {
  found(ctx.sessions.heartbeat(params[0]!) || null, 'Session');
  sendJson(res, 200, { ok: true });
});

route('DELETE', '/sessions/:id', 'unregister', (ctx, { params }, res) => {
  found(ctx.sessions.unregister(params[0]!) || null, 'Session');
  sendEmpty(res);
});

route(
  'GET',
  '/sessions/:id/comments',
  'full comments, ?status=open|resolved|all',
  (ctx, r, res) => {
    const file = found(ctx.store.locateSession(r.params[0]!), 'Session');
    const status = r.url.searchParams.get('status') ?? 'all';
    const data = ctx.store.readSession(file);
    const comments = data.comments.filter(
      (c) => status === 'all' || (status === 'resolved') === (c.status === 'resolved'),
    );
    sendJson(res, 200, { session: data.session, comments });
  },
);

route('GET', '/state', 'browser view, ?app=', (ctx, { url }, res) => {
  const app = url.searchParams.get('app');
  if (!app) throw new HttpError(400, '"app" is required');
  sendJson(res, 200, state(ctx, app));
});

route(
  'PUT',
  '/comments',
  'browser upsert { app, comments, deleted? }',
  async (ctx, { req }, res) => {
    const body = object(await readJson(req));
    const app = text(body, 'app');
    const { comments, deleted = [] } = body;
    if (!Array.isArray(comments) || comments.some((c) => typeof object(c).id !== 'string')) {
      throw new HttpError(400, '"comments" must be an array of comments with an id');
    }
    if (!Array.isArray(deleted) || deleted.some((id) => typeof id !== 'string')) {
      throw new HttpError(400, '"deleted" must be an array of ids');
    }
    const stored = new Map(ctx.store.commentsForApp(app).map((c) => [c.id, c]));
    const next = (comments as PointoutComment[]).map((c) => fromBrowser(c, stored.get(c.id), app));
    ctx.store.upsertComments(next, fallbackProject(ctx));
    ctx.store.deleteComments(deleted as string[], app);
    sendJson(res, 200, state(ctx, app));
  },
);

route('POST', '/comments/:id/replies', 'append { from, text }', async (ctx, r, res) => {
  const body = object(await readJson(r.req));
  const from = body.from ?? 'claude';
  if (from !== 'claude' && from !== 'user') throw new HttpError(400, '"from" is claude or user');
  const reply = { from, text: text(body, 'text'), at: new Date().toISOString() } as const;
  const updated = ctx.store.updateComment(r.params[0]!, (c) => ({
    ...c,
    replies: [...(c.replies ?? []), reply],
  }));
  sendJson(res, 200, found(updated, 'Comment'));
});

route('PATCH', '/comments/:id', 'set { status }', async (ctx, r, res) => {
  const status = object(await readJson(r.req)).status;
  if (status !== 'open' && status !== 'resolved') {
    throw new HttpError(400, '"status" is open or resolved');
  }
  const updated = ctx.store.updateComment(r.params[0]!, (c) => setStatus(c, status));
  sendJson(res, 200, found(updated, 'Comment'));
});

route('DELETE', '/comments/:id', 'remove', (ctx, { params }, res) => {
  found(ctx.store.deleteComments([params[0]!]) || null, 'Comment');
  sendEmpty(res);
});
