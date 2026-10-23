import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, PortTakenError, type HubClient } from './client';
import { createStore } from './hub/store';
import { createSession } from './session';
import { freePort, hubComment, tempHome } from './testing';
import { createServer, type Server } from 'node:http';

let home: string;
let cleanup: () => void;
let port: number;
const clients: HubClient[] = [];

beforeEach(async () => {
  ({ home, cleanup } = tempHome());
  port = await freePort();
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
  cleanup();
});

function instance(pid: number): HubClient {
  const client = createClient({ port, home, pid });
  clients.push(client);
  return client;
}

describe('hub takeover', () => {
  it('the first instance is the hub, the next one takes over when it dies', async () => {
    const first = instance(1001);
    const second = instance(2002);
    await first.ensureHub();
    await second.ensureHub();
    expect(first.hub?.pid).toBe(1001);
    expect(second.hub).toBeNull();

    const a = createSession(first, 'shop', 1001);
    const b = createSession(second, 'shop', 2002);
    await a.start();
    await b.start();
    expect(b.info.name).toBe('shop #2');
    await second.putComments({
      app: 'Shop',
      comments: [hubComment('c1', { sessionId: b.info.id })],
    });
    expect((await second.health()).pid).toBe(1001);

    await first.close();

    const health = await second.health();
    expect(health.pid).toBe(2002);
    expect(second.hub?.pid).toBe(2002);
    // The new hub registered its own session before retrying the call.
    expect((await second.sessions()).map((s) => s.id)).toEqual([b.info.id]);
    expect(createStore(home).findComment('c1')?.file.name).toBe(b.info.id);
    expect((await second.sessionComments(b.info.id)).comments).toHaveLength(1);
    await a.stop();
    await b.stop();
  });

  it('retries the health probe once before calling a slow hub foreign', async () => {
    let calls = 0;
    const slow: Server = createServer((_req, res) => {
      const answer = () => res.end(JSON.stringify({ ok: true, version: 'test' }));
      if (calls++ === 0) setTimeout(answer, 1_500);
      else answer();
    });
    await new Promise<void>((resolve) => slow.listen(port, '127.0.0.1', resolve));
    try {
      const client = instance(1);
      await client.ensureHub();
      expect(client.hub).toBeNull();
      expect(calls).toBe(2);
    } finally {
      slow.closeAllConnections();
      slow.close();
    }
  });

  it('refuses a port held by something else', async () => {
    const other: Server = createServer((_req, res) => res.end('hello'));
    await new Promise<void>((resolve) => other.listen(port, '127.0.0.1', resolve));
    try {
      await expect(instance(1).ensureHub()).rejects.toBeInstanceOf(PortTakenError);
    } finally {
      other.close();
    }
  });
});
