import type { PointoutReply } from '@point-out/core/format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hubComment, tempHome } from '../testing';
import { MAX_BODY } from './http';
import type { LiveSession } from './sessions';
import { tryListen, type Hub } from './start';
import { createStore, type HubComment, type SessionMeta } from './store';

/** Every field the routes answer with, typed loosely so assertions stay short. */
interface Body {
  error: string;
  name: string;
  status?: string;
  replies: PointoutReply[];
  session: SessionMeta | null;
  sessions: LiveSession[];
  comments: HubComment[];
}

const anyString = expect.any(String) as string;

let hub: Hub;
let base: string;
let home: string;
let cleanup: () => void;

beforeEach(async () => {
  ({ home, cleanup } = tempHome());
  const result = await tryListen({ port: 0, home });
  if (result.status !== 'hub') throw new Error('expected to be the hub');
  hub = result.hub;
  base = `http://127.0.0.1:${hub.port}`;
});

afterEach(async () => {
  await hub.close();
  cleanup();
});

async function call(method: string, path: string, body?: unknown, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { res, status: res.status, body: (text ? JSON.parse(text) : undefined) as Body };
}

const register = (id: string, name = `shop ${id}`, project = 'shop') =>
  call('POST', '/sessions', { id, name, project, pid: 42 });

const put = (comments: Partial<HubComment>[], deleted?: string[]) =>
  call('PUT', '/comments', { app: 'Shop', comments, deleted });

const reply = { from: 'claude', text: 'Done' };

describe('hub server', () => {
  it('serves a plain text index and health', async () => {
    const index = await fetch(base + '/');
    expect(index.headers.get('content-type')).toMatch(/text\/plain/);
    const text = await index.text();
    expect(text).toContain(`pid ${process.pid}`);
    expect(text).toContain(`Store: ${home}`);
    expect(text).toContain('PUT    /comments');
    expect(text).toContain('Local dev data, no auth, 127.0.0.1 only.');

    const health = await call('GET', '/health');
    expect(health.body).toEqual({
      ok: true,
      version: anyString,
      pid: process.pid,
      port: hub.port,
      home,
      sessions: 0,
    });
  });

  it('registers, renames, heartbeats and unregisters sessions', async () => {
    const created = await register('s1');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ id: 's1', name: 'shop s1', project: 'shop', pid: 42 });
    expect((await register('s1')).status).toBe(201);

    expect((await call('PUT', '/sessions/s1', { name: 'checkout' })).body.name).toBe('checkout');
    expect((await call('POST', '/sessions/s1/heartbeat')).body).toEqual({ ok: true });
    expect((await call('GET', '/sessions')).body.sessions).toHaveLength(1);

    const file = createStore(home).readSession({ project: 'shop', name: 's1' });
    expect(file.session).toMatchObject({ id: 's1', name: 'checkout', project: 'shop' });

    expect((await call('DELETE', '/sessions/s1')).status).toBe(204);
    expect((await call('GET', '/sessions')).body.sessions).toEqual([]);
    expect(createStore(home).readSession({ project: 'shop', name: 's1' }).session?.endedAt).toEqual(
      expect.any(String),
    );
    expect((await call('POST', '/sessions/s1/heartbeat')).status).toBe(404);
  });

  it('rejects bad input with 400 and unknown routes with 404', async () => {
    expect((await call('POST', '/sessions', { id: '../x', name: 'a', project: 'p' })).status).toBe(
      400,
    );
    expect((await call('GET', '/state')).body).toEqual({ error: '"app" is required' });
    expect((await call('PUT', '/comments', { app: 'Shop', comments: [{}] })).status).toBe(400);
    const bad = await fetch(base + '/comments', { method: 'PUT', body: '{ nope' });
    expect(bad.status).toBe(400);
    expect((await call('GET', '/nope')).body).toEqual({ error: 'No route for GET /nope' });
    expect((await call('PATCH', '/comments/zz', { status: 'resolved' })).status).toBe(404);
  });

  it('allows CORS for localhost origins only', async () => {
    const local = await call('GET', '/health', undefined, { origin: 'http://localhost:4200' });
    expect(local.res.headers.get('access-control-allow-origin')).toBe('http://localhost:4200');

    const evil = await call('GET', '/health', undefined, { origin: 'http://evil.example' });
    expect(evil.status).toBe(403);
    expect(evil.res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight with the methods and content-type', async () => {
    const res = await fetch(base + '/comments', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:4200',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:4200');
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(res.headers.get('access-control-allow-headers')).toBe('content-type');
  });

  it('upserts browser comments and keeps the hub owned status and replies', async () => {
    await register('s1');
    await put([hubComment('c1', { sessionId: 's1' })]);
    await call('POST', '/comments/c1/replies', reply);
    await call('PATCH', '/comments/c1', { status: 'resolved' });

    const fake = [{ from: 'user', text: 'forged', at: 'x' }];
    const { body } = await put([
      hubComment('c1', { sessionId: 's1', comment: 'Edited', replies: fake as never }),
    ]);
    expect(body.comments).toEqual([
      { id: 'c1', sessionId: 's1', status: 'resolved', replies: [expect.objectContaining(reply)] },
    ]);
    const stored = (await call('GET', '/sessions/s1/comments')).body.comments;
    expect(stored[0]).toMatchObject({ comment: 'Edited', app: 'Shop', status: 'resolved' });
  });

  it('accepts a status the browser sends, and never wipes comments another tab did not send', async () => {
    await register('s1');
    await put([hubComment('c1', { sessionId: 's1' }), hubComment('c2', { sessionId: 's1' })]);
    await call('PATCH', '/comments/c1', { status: 'resolved' });

    const { body } = await put([hubComment('c1', { sessionId: 's1', status: 'open' })]);
    expect(body.comments.map((c) => [c.id, c.status ?? 'open'])).toEqual([
      ['c1', 'open'],
      ['c2', 'open'],
    ]);
  });

  it('honours deleted ids for its own app only', async () => {
    await put([hubComment('c1'), hubComment('c2')]);
    await call('PUT', '/comments', { app: 'Blog', comments: [hubComment('b1', { app: 'Blog' })] });
    const { body } = await put([], ['c1', 'b1']);
    expect(body.comments.map((c) => c.id)).toEqual(['c2']);
    expect((await call('GET', '/state?app=Blog')).body.comments).toHaveLength(1);
  });

  it('moves a comment when its sessionId changes', async () => {
    await register('s1');
    await register('s2');
    await put([hubComment('c1', { sessionId: 's1' })]);
    await put([hubComment('c1', { sessionId: 's2' })]);
    expect((await call('GET', '/sessions/s1/comments')).body.comments).toEqual([]);
    expect((await call('GET', '/sessions/s2/comments')).body.comments).toHaveLength(1);
  });

  it('files unassigned comments under the live project, or _unassigned without one', async () => {
    await put([hubComment('c1')]);
    expect(createStore(home).findComment('c1')!.file.project).toBe('_unassigned');
    await register('s1');
    await put([hubComment('c2')]);
    expect(createStore(home).findComment('c2')!.file).toEqual({
      project: 'shop',
      name: '_unassigned',
    });
  });

  it('GET /state returns live sessions and only that app', async () => {
    await register('s1');
    await register('s2');
    await call('DELETE', '/sessions/s2');
    await put([hubComment('c1', { sessionId: 's1' })]);
    await call('PUT', '/comments', { app: 'Blog', comments: [hubComment('b1', { app: 'Blog' })] });

    const { body } = await call('GET', `/state?app=${encodeURIComponent('Shop')}`);
    expect(body).toEqual({
      sessions: [{ id: 's1', name: 'shop s1', project: 'shop' }],
      comments: [{ id: 'c1', sessionId: 's1' }],
    });
  });

  it('serves tool routes: filtered comments, replies, status, delete', async () => {
    await register('s1');
    await put([hubComment('c1', { sessionId: 's1' }), hubComment('c2', { sessionId: 's1' })]);
    await call('PATCH', '/comments/c2', { status: 'resolved' });

    const open = await call('GET', '/sessions/s1/comments?status=open');
    expect(open.body.comments.map((c) => c.id)).toEqual(['c1']);
    expect(open.body.session).toMatchObject({ id: 's1' });
    const resolved = await call('GET', '/sessions/s1/comments?status=resolved');
    expect(resolved.body.comments.map((c) => c.id)).toEqual(['c2']);

    const replied = await call('POST', '/comments/c1/replies', { from: 'user', text: 'Thanks' });
    expect(replied.body.replies).toEqual([{ from: 'user', text: 'Thanks', at: anyString }]);
    expect((await call('POST', '/comments/c1/replies', { from: 'bot', text: 'x' })).status).toBe(
      400,
    );
    expect((await call('PATCH', '/comments/c2', { status: 'open' })).body.status).toBeUndefined();

    expect((await call('DELETE', '/comments/c1')).status).toBe(204);
    expect((await call('DELETE', '/comments/c1')).status).toBe(404);
    expect((await call('GET', '/sessions/nope/comments')).status).toBe(404);
  });

  it('caps bodies at 10 MB', async () => {
    const big = 'x'.repeat(MAX_BODY + 1);
    const res = await fetch(base + '/comments', { method: 'PUT', body: big });
    expect(res.status).toBe(413);

    const stored = () => createStore(home).findComment('c1')?.comment.screenshotDataUrl;
    await put([hubComment('c1', { screenshotDataUrl: 'data:image/png;base64,x' })]);
    await put([hubComment('c1')]);
    expect(stored()).toBe('data:image/png;base64,x');

    const fits = hubComment('c1', {
      screenshotDataUrl: 'data:image/png;base64,' + 'x'.repeat(5e6),
    });
    expect((await put([fits])).status).toBe(200);
  });
});
