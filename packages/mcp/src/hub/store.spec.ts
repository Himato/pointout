import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hubComment, tempHome } from '../testing';
import { createStore, type Store } from './store';

let home: string;
let cleanup: () => void;
let store: Store;

beforeEach(() => {
  ({ home, cleanup } = tempHome());
  store = createStore(home);
});
afterEach(() => cleanup());

const session = (id: string, project = 'shop') => ({
  id,
  name: `${project} #1`,
  project,
  startedAt: '2026-10-23T09:00:00.000Z',
});

describe('store', () => {
  it('round trips a session file and leaves no tmp file behind', () => {
    const data = { version: 1 as const, session: session('s1'), comments: [hubComment('c1')] };
    store.writeSession({ project: 'shop', name: 's1' }, data);

    expect(store.readSession({ project: 'shop', name: 's1' })).toEqual(data);
    expect(readdirSync(join(home, 'shop'))).toEqual(['s1.json']);
    expect(store.listSessionFiles()).toEqual([{ project: 'shop', name: 's1' }]);
  });

  it('treats a missing or corrupt file as empty', () => {
    mkdirSync(join(home, 'shop'));
    writeFileSync(join(home, 'shop', 'bad.json'), '{ nope');

    const blank = { version: 1, session: null, comments: [] };
    expect(store.readSession({ project: 'shop', name: 'bad' })).toEqual(blank);
    expect(store.readSession({ project: 'shop', name: 'none' })).toEqual(blank);
    expect(store.commentsForApp('Shop')).toEqual([]);
  });

  it('ignores temp files left by a killed hub, and removes them on request', () => {
    store.writeSession(
      { project: 'shop', name: 's1' },
      { version: 1, session: null, comments: [] },
    );
    writeFileSync(join(home, 'shop', 's1.json.4242.tmp'), '{ half');

    expect(store.listSessionFiles()).toEqual([{ project: 'shop', name: 's1' }]);
    store.removeStaleTemps();
    expect(readdirSync(join(home, 'shop'))).toEqual(['s1.json']);
  });

  it('refuses unsafe file names', () => {
    expect(() => store.readSession({ project: '..', name: 'x' })).toThrow(/Unsafe/);
    expect(store.locateSession('../etc')).toBeNull();
  });

  it('routes upserts by sessionId and moves a comment when it changes', () => {
    store.writeSession(
      { project: 'shop', name: 's1' },
      { version: 1, session: session('s1'), comments: [] },
    );
    store.writeSession(
      { project: 'blog', name: 's2' },
      { version: 1, session: session('s2', 'blog'), comments: [] },
    );

    store.upsertComments([hubComment('c1', { sessionId: 's1' }), hubComment('c2')]);
    expect(store.readSession({ project: 'shop', name: 's1' }).comments.map((c) => c.id)).toEqual([
      'c1',
    ]);
    expect(
      store.readSession({ project: '_unassigned', name: '_unassigned' }).comments.map((c) => c.id),
    ).toEqual(['c2']);

    store.upsertComments([hubComment('c1', { sessionId: 's2', comment: 'Edited' })]);
    expect(store.readSession({ project: 'shop', name: 's1' }).comments).toEqual([]);
    expect(store.findComment('c1')).toEqual({
      file: { project: 'blog', name: 's2' },
      comment: hubComment('c1', { sessionId: 's2', comment: 'Edited' }),
    });
  });

  it('files unassigned comments under the fallback project, then keeps them there', () => {
    store.upsertComments([hubComment('c1')], 'shop');
    expect(existsSync(join(home, 'shop', '_unassigned.json'))).toBe(true);
    store.upsertComments([hubComment('c1', { comment: 'Again' })]);
    expect(store.findComment('c1')!.file).toEqual({ project: 'shop', name: '_unassigned' });
  });

  it('deletes by id, only within the app when one is given', () => {
    store.upsertComments([hubComment('c1'), hubComment('c2'), hubComment('c3', { app: 'Blog' })]);
    expect(store.deleteComments(['c1', 'c3'], 'Shop')).toBe(1);
    expect(store.commentsForApp('Shop').map((c) => c.id)).toEqual(['c2']);
    expect(store.deleteComments(['c3'])).toBe(1);
    expect(store.commentsForApp('Blog')).toEqual([]);
  });

  it('collects one app across every file', () => {
    store.writeSession(
      { project: 'shop', name: 's1' },
      { version: 1, session: session('s1'), comments: [] },
    );
    store.upsertComments([
      hubComment('c1', { sessionId: 's1' }),
      hubComment('c2'),
      hubComment('c3', { app: 'Blog' }),
    ]);
    expect(
      store
        .commentsForApp('Shop')
        .map((c) => c.id)
        .sort(),
    ).toEqual(['c1', 'c2']);
  });

  it('updates one comment in place', () => {
    store.upsertComments([hubComment('c1')]);
    const next = store.updateComment('c1', (c) => ({ ...c, status: 'resolved' }));
    expect(next?.status).toBe('resolved');
    expect(store.findComment('c1')!.comment.status).toBe('resolved');
    expect(store.updateComment('nope', (c) => c)).toBeNull();
  });
});
