import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubRecord } from './merge';
import { createSync, hubUrl, type Sync } from './sync';
import type { PointoutComment, SyncSession } from './types';

const URL = 'http://127.0.0.1:7331';
const s1: SyncSession = { id: 's1', name: 'shop #1', project: 'shop' };
const s2: SyncSession = { id: 's2', name: 'shop #2', project: 'shop' };

function comment(id: string, extra: Partial<PointoutComment> = {}): PointoutComment {
  return {
    id,
    n: 1,
    comment: 'Fix it',
    screenshotDataUrl: 'data:image/png;base64,x',
    ...extra,
  } as PointoutComment;
}

interface Hub {
  sessions: SyncSession[];
  comments: Array<HubRecord & Record<string, unknown>>;
  down: boolean;
}

let hub: Hub;
let local: PointoutComment[];
let sync: Sync;
const fetch = vi.fn();
const onState = vi.fn();
const onMerge = vi.fn();

function setup(): void {
  fetch.mockImplementation((input: string) => {
    if (hub.down) return Promise.reject(new TypeError('Failed to fetch'));
    const body = { sessions: hub.sessions, comments: hub.comments };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body), url: input });
  });
  sync = createSync({
    url: URL,
    app: 'Shop & co',
    getComments: () => local,
    onState,
    onMerge,
    fetch,
  });
}

const puts = () => fetch.mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PUT');
const lastPutBody = () =>
  JSON.parse((puts().at(-1)![1] as RequestInit).body as string) as {
    app: string;
    comments: PointoutComment[];
    deleted?: string[];
  };
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  hub = { sessions: [], comments: [], down: false };
  local = [];
  fetch.mockReset();
  onState.mockReset();
  onMerge.mockReset();
  setup();
});

afterEach(() => {
  sync.stop();
  vi.useRealTimers();
});

describe('hubUrl', () => {
  it('maps true to the default hub and trims a trailing slash', () => {
    expect(hubUrl(true)).toBe(URL);
    expect(hubUrl('http://localhost:9000/')).toBe('http://localhost:9000');
  });
});

describe('createSync', () => {
  it('debounces changes into one PUT /comments with the whole list', async () => {
    local = [comment('c1')];
    sync.push();
    sync.push();
    await vi.advanceTimersByTimeAsync(299);
    expect(puts()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(puts()).toHaveLength(1);
    const [url, init] = puts()[0]! as [string, RequestInit];
    expect(url).toBe(`${URL}/comments`);
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(lastPutBody()).toEqual({ app: 'Shop & co', comments: [comment('c1')] });
  });

  it('sends forgotten ids as deleted until a push succeeds', async () => {
    local = [comment('c2')];
    sync.forget(['c1']);
    hub.down = true;
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().deleted).toEqual(['c1']);

    hub.down = false;
    sync.forget(['c3']);
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody()).toEqual({
      app: 'Shop & co',
      comments: [comment('c2')],
      deleted: ['c1', 'c3'],
    });

    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().deleted).toBeUndefined();
  });

  it('sends status only for comments the user resolved or reopened, until a push succeeds', async () => {
    local = [comment('c1', { status: 'resolved' }), comment('c2', { status: 'resolved' })];
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().comments.map((c) => c.status)).toEqual([undefined, undefined]);

    sync.touchStatus('c2');
    hub.down = true;
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().comments.map((c) => c.status)).toEqual([undefined, 'resolved']);

    hub.down = false;
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().comments.map((c) => c.status)).toEqual([undefined, 'resolved']);

    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().comments.map((c) => c.status)).toEqual([undefined, undefined]);
  });

  it('keeps a status click made while a push is in flight', async () => {
    let answer: (value: unknown) => void = () => {};
    fetch.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    local = [comment('c1', { status: 'resolved' })];
    sync.touchStatus('c1');
    sync.push();
    await vi.advanceTimersByTimeAsync(300);

    local = [comment('c1', { status: 'open' })];
    sync.touchStatus('c1');
    answer({ ok: true, json: () => Promise.resolve({ sessions: [], comments: [] }) });
    await flush();
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(lastPutBody().comments[0]!.status).toBe('open');
  });

  it('polls GET /state with the app name encoded', async () => {
    sync.start();
    await flush();
    expect(fetch.mock.calls[0]![0]).toBe(`${URL}/state?app=Shop%20%26%20co`);
  });

  it('auto picks the single live session and sends unassigned comments to it', async () => {
    hub.sessions = [s1];
    local = [comment('c1'), comment('c2', { sessionId: 'elsewhere' })];
    sync.start();
    await flush();

    expect(onState).toHaveBeenLastCalledWith('connected', [s1], s1);
    expect(sync.target).toEqual(s1);
    // First contact with comments the hub has never seen pushes them.
    await vi.advanceTimersByTimeAsync(300);
    const sent = lastPutBody().comments;
    expect(sent.map((c) => c.sessionId)).toEqual(['s1', 'elsewhere']);
  });

  it('leaves comments unassigned when several sessions are live and nobody picked', async () => {
    hub.sessions = [s1, s2];
    local = [comment('c1')];
    sync.start();
    await vi.advanceTimersByTimeAsync(300);

    expect(sync.target).toBeNull();
    expect(lastPutBody().comments[0]!.sessionId).toBeUndefined();
  });

  it('strips the screenshot from comments the hub already knows', async () => {
    hub.comments = [{ id: 'c1', sessionId: 's1' }];
    local = [comment('c1', { sessionId: 's1' }), comment('c2', { sessionId: 's1' })];
    sync.start();
    await vi.advanceTimersByTimeAsync(300);

    const [known, fresh] = lastPutBody().comments;
    expect(known!.screenshotDataUrl).toBeUndefined();
    expect(fresh!.screenshotDataUrl).toBe('data:image/png;base64,x');
  });

  it('hands the hub fields of every polled record to onMerge', async () => {
    const replies = [{ from: 'claude' as const, text: 'Done', at: '2026-10-23T09:00:00.000Z' }];
    hub.comments = [{ id: 'c1', sessionId: 's1', status: 'resolved', replies, comment: 'ignored' }];
    sync.start();
    await flush();

    expect(onMerge).toHaveBeenCalledWith([
      { id: 'c1', sessionId: 's1', status: 'resolved', replies },
    ]);
  });

  it('does not merge a poll while a local edit is still waiting to go out', async () => {
    hub.comments = [{ id: 'c1', status: 'open' }];
    sync.start();
    await flush();
    onMerge.mockClear();

    await vi.advanceTimersByTimeAsync(2_800);
    sync.push();
    await vi.advanceTimersByTimeAsync(200); // the poll lands inside the debounce window
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onMerge).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(100); // the push goes out and its answer is merged
    expect(puts()).toHaveLength(1);
    expect(onMerge).toHaveBeenCalledTimes(1);
  });

  it('goes offline once, logs once, and retries after 30 s', async () => {
    hub.down = true;
    sync.start();
    await flush();

    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenLastCalledWith('offline', [], null);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith('[pointout] hub offline, will retry');

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledTimes(1);

    hub.down = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onState).toHaveBeenLastCalledWith('connected', [], null);
    expect(console.info).toHaveBeenLastCalledWith(`[pointout] hub connected at ${URL}`);
  });

  it('treats a non 2xx answer as offline and never throws', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
    sync.push();
    await vi.advanceTimersByTimeAsync(300);
    expect(onState).toHaveBeenLastCalledWith('offline', [], null);
  });

  it('only reports state when something changed', async () => {
    hub.sessions = [s1];
    sync.start();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(onState).toHaveBeenCalledTimes(1);
  });

  it('keeps a picked session until it disappears, then falls back to auto', async () => {
    hub.sessions = [s1, s2];
    sync.start();
    await flush();
    sync.setSession('s2');
    expect(sync.target).toEqual(s2);
    expect(onState).toHaveBeenLastCalledWith('connected', [s1, s2], s2);

    await vi.advanceTimersByTimeAsync(3_000);
    expect(sync.target).toEqual(s2);

    hub.sessions = [s1];
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sync.target).toEqual(s1);

    hub.sessions = [s1, s2];
    await vi.advanceTimersByTimeAsync(3_000);
    expect(sync.target).toBeNull();
  });

  it('stops polling on stop()', async () => {
    sync.start();
    await flush();
    sync.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
