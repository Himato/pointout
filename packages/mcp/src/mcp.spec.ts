import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { defaultFormatter } from '@pointout/core/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient, type HubClient } from './client';
import { toComment, type compact } from './format';
import { createMcpServer, TRIAGE } from './mcp';
import { createSession, type Session } from './session';
import { freePort, hubComment, tempHome } from './testing';

type Compact = ReturnType<typeof compact>;
interface SessionView {
  session: { id: string; name: string; project: string };
  hub: { pid: number; port: number; home: string };
  live: Array<{ id: string; name: string; project: string }>;
  counts: { open: number; resolved: number };
}

let cleanup: () => void;
const anyString = expect.any(String) as string;

let hub: HubClient;
let session: Session;
let mcp: Client;

beforeEach(async () => {
  const temp = tempHome();
  cleanup = temp.cleanup;
  hub = createClient({ port: await freePort(), home: temp.home });
  await hub.ensureHub();
  session = createSession(hub, 'shop');
  await session.start();

  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer(hub, session).connect(serverSide);
  mcp = new Client({ name: 'test', version: '0.0.0' });
  await mcp.connect(clientSide);
});

afterEach(async () => {
  await mcp.close();
  await session.stop();
  await hub.close();
  cleanup();
});

const seed = (...comments: ReturnType<typeof hubComment>[]) =>
  hub.putComments({ app: 'Shop', comments });

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = (await mcp.callTool({ name, arguments: args })) as {
    isError?: boolean;
    content: Array<{ type: string; text: string }>;
  };
  const text = result.content[0]!.text;
  return {
    isError: result.isError ?? false,
    text,
    json: <T = Compact[]>() => JSON.parse(text) as T,
  };
}

async function other(id: string, name: string) {
  await hub.register({ id, name, project: 'shop', pid: 1 });
}

describe('mcp tools', () => {
  it('lists the six tools and the triage prompt', async () => {
    const { tools } = await mcp.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'pointout_brief',
      'pointout_list',
      'pointout_reopen',
      'pointout_reply',
      'pointout_resolve',
      'pointout_session',
    ]);
    const prompt = await mcp.getPrompt({ name: 'triage' });
    expect(prompt.messages[0]!.content).toEqual({ type: 'text', text: TRIAGE });
  });

  it('lists open comments by default with a readable label', async () => {
    const id = session.info.id;
    await seed(hubComment('c1', { sessionId: id }), hubComment('c2', { sessionId: id, n: 2 }));
    await hub.setStatus('c2', 'resolved');

    expect((await call('pointout_list')).json()).toEqual([
      {
        id: 'c1',
        n: 1,
        status: 'open',
        label: 'CartComponent (cart.ts) › button.pay',
        url: '/cart',
        text: 'Pay',
        comment: 'Make it bigger',
        replies: [],
      },
    ]);
    expect((await call('pointout_list', { status: 'all' })).json()).toHaveLength(2);
    expect((await call('pointout_list', { status: 'resolved' })).json()[0]!.id).toBe('c2');
  });

  it('briefs exactly what the browser would copy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:00:00.000Z'));
    const id = session.info.id;
    const comments = [
      hubComment('c1', { sessionId: id }),
      hubComment('c2', { sessionId: id, n: 2, owner: null }),
    ];
    await seed(...comments);
    await hub.setStatus('c2', 'resolved');

    const { text } = await call('pointout_brief');
    vi.useRealTimers();
    const expected = defaultFormatter({
      appName: 'Shop',
      createdAt: '2026-10-23T10:00:00.000Z',
      viewport: comments[0]!.viewport,
      comments: comments
        .map(toComment)
        .map((c) => (c.id === 'c2' ? { ...c, status: 'resolved' as const } : c)),
    });
    expect(text).toBe(expected);
    expect(text).toContain('1 open, 1 resolved');
  });

  it('replies, resolves with a note, and reopens', async () => {
    await seed(hubComment('c1', { sessionId: session.info.id }), hubComment('c2'));

    const replied = (
      await call('pointout_reply', { id: 'c1', text: 'Bigger now' })
    ).json<Compact>();
    expect(replied.replies).toEqual([{ from: 'claude', text: 'Bigger now', at: anyString }]);

    const resolved = (await call('pointout_resolve', { ids: ['c1', 'c2'], note: 'Fixed' })).json();
    expect(resolved.map((c) => c.status)).toEqual(['resolved', 'resolved']);
    expect(resolved[0]!.replies.map((r) => r.text)).toEqual(['Bigger now', 'Fixed']);

    const state = await hub.state('Shop');
    expect(state.comments.every((c) => c.status === 'resolved')).toBe(true);

    expect((await call('pointout_reopen', { id: 'c1' })).json<Compact>().status).toBe('open');

    const missing = await call('pointout_resolve', { ids: ['c2', 'nope'] });
    expect(missing.isError).toBe(true);
    expect(missing.text).toBe('Unknown comment ids: nope. Resolved: c2.');
    expect((await call('pointout_reply', { id: 'nope', text: 'x' })).isError).toBe(true);
  });

  it('describes and renames this session', async () => {
    await seed(hubComment('c1', { sessionId: session.info.id }));
    const info = (await call('pointout_session', { name: 'checkout' })).json<SessionView>();
    expect(info.session).toMatchObject({ id: session.info.id, name: 'checkout', project: 'shop' });
    expect(info.hub).toEqual({ pid: process.pid, port: hub.hub!.port, home: anyString });
    expect(info.live).toEqual([{ id: session.info.id, name: 'checkout', project: 'shop' }]);
    expect(info.counts).toEqual({ open: 1, resolved: 0 });
    expect((await hub.sessions())[0]!.name).toBe('checkout');
  });

  it('reads another session by name and errors on an ambiguous one', async () => {
    await other('aaaaaa', 'twin');
    await other('bbbbbb', 'twin');
    await other('cccccc', 'solo');
    await seed(hubComment('c1', { sessionId: 'cccccc' }));

    expect((await call('pointout_list', { session: 'solo' })).json()[0]!.id).toBe('c1');
    const ambiguous = await call('pointout_list', { session: 'twin' });
    expect(ambiguous.isError).toBe(true);
    expect(ambiguous.text).toContain('twin (aaaaaa), twin (bbbbbb)');
    const unknown = await call('pointout_brief', { session: 'ghost' });
    expect(unknown.isError).toBe(true);
    expect(unknown.text).toMatch(/^No session "ghost"\. Live sessions: /);
  });

  it('points at other sessions when this one has nothing', async () => {
    await other('cccccc', 'shop #9');
    await seed(hubComment('c1', { sessionId: 'cccccc' }));

    const hint = `No comments for session ${session.info.name}. Live sessions with open comments: shop #9 (cccccc): 1 open. Pass session to read one.\nOpen comments left with ended sessions or in _unassigned move to a live session on the browser's next push.`;
    expect((await call('pointout_list')).text).toBe(hint);
    expect((await call('pointout_brief')).text).toBe(hint);
  });

  it('says so plainly when nobody has comments', async () => {
    expect((await call('pointout_list')).json()).toEqual([]);
    expect((await call('pointout_brief')).text).toBe(
      `No comments for session ${session.info.name} yet.\nOpen comments left with ended sessions or in _unassigned move to a live session on the browser's next push.`,
    );
  });
});
