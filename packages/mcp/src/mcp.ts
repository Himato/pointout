import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { HubError, type HubClient, type StatusFilter } from './client';
import { brief, compact } from './format';
import type { Session } from './session';
import { VERSION } from './version';

export const TRIAGE =
  'Call pointout_brief. Fix each open item inside the component named, using the file path when ' +
  'given. After each fix call pointout_reply with one line on what changed, then ' +
  'pointout_resolve. Ask before touching anything outside those components.';

/** The hub cannot list these, so Claude learns they exist and where they go. */
const STRAYS =
  'Open comments left with ended sessions or in _unassigned move to a live session on the ' +
  "browser's next push.";

class ToolError extends Error {}

const ok = (text: string): CallToolResult => ({ content: [{ type: 'text', text }] });
const json = (value: unknown) => ok(JSON.stringify(value, null, 2));

/** Tool errors go back to Claude as plain text it can act on, never as a crash. */
function tool<A>(run: (args: A) => Promise<CallToolResult>) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await run(args);
    } catch (error) {
      return { isError: true, content: [{ type: 'text', text: (error as Error).message }] };
    }
  };
}

/** The six tools and the `triage` prompt, all talking to the hub through `client`. */
export function createMcpServer(client: HubClient, session: Session): McpServer {
  const server = new McpServer({ name: 'pointout', version: VERSION });

  /** An id or a name, defaulting to this session. Ambiguous names list the candidates. */
  async function resolveSession(ref?: string): Promise<{ id: string; name: string }> {
    if (!ref) return session.info;
    const live = await client.sessions();
    const byId = live.find((s) => s.id === ref);
    if (byId) return byId;
    const named = live.filter((s) => s.name.toLowerCase() === ref.toLowerCase());
    if (named.length === 1) return named[0]!;
    if (named.length > 1) {
      const list = named.map((s) => `${s.name} (${s.id})`).join(', ');
      throw new ToolError(`Session name "${ref}" is ambiguous: ${list}. Pass the id instead.`);
    }
    return { id: ref, name: ref };
  }

  /** One line pointing Claude at the sessions that do have work, or null when none do. */
  async function elsewhere(target: { id: string; name: string }): Promise<string | null> {
    const others = (await client.sessions()).filter((s) => s.id !== target.id);
    const busy: string[] = [];
    for (const other of others) {
      const { comments } = await client.sessionComments(other.id, 'open');
      if (comments.length) busy.push(`${other.name} (${other.id}): ${comments.length} open`);
    }
    if (!busy.length) return null;
    return `No comments for session ${target.name}. Live sessions with open comments: ${busy.join(', ')}. Pass session to read one.\n${STRAYS}`;
  }

  async function commentsOf(ref: string | undefined, status: StatusFilter) {
    const target = await resolveSession(ref);
    try {
      return { target, ...(await client.sessionComments(target.id, status)) };
    } catch (error) {
      if (!(error instanceof HubError && error.status === 404)) throw error;
      const live = (await client.sessions()).map((s) => `${s.name} (${s.id})`).join(', ');
      throw new ToolError(`No session "${ref}". Live sessions: ${live || 'none'}.`);
    }
  }

  server.registerTool(
    'pointout_session',
    {
      title: 'This Pointout session',
      description:
        'Shows this Claude session as the browser sees it, the hub, every live session, and how ' +
        'many comments are open or resolved here. Pass name to rename this session so the ' +
        'person can pick it in the Pointout menu.',
      inputSchema: { name: z.string().min(1).max(80).optional().describe('New session name') },
    },
    tool(async ({ name }: { name?: string }) => {
      if (name) await session.rename(name);
      const [health, live, mine] = await Promise.all([
        client.health(),
        client.sessions(),
        client.sessionComments(session.info.id, 'all'),
      ]);
      const resolved = mine.comments.filter((c) => c.status === 'resolved').length;
      return json({
        session: session.info,
        hub: { pid: health.pid, port: health.port, home: health.home },
        live: live.map(({ id, name, project }) => ({ id, name, project })),
        counts: { open: mine.comments.length - resolved, resolved },
      });
    }),
  );

  const sessionArg = z
    .string()
    .optional()
    .describe('Session id or name. Defaults to this session.');

  server.registerTool(
    'pointout_list',
    {
      title: 'List Pointout comments',
      description:
        'Lists the comments a person left on elements of their running app, as JSON: id, n, ' +
        'status, label (Component (file) › selector), url, text, comment, replies.',
      inputSchema: {
        status: z.enum(['open', 'resolved', 'all']).optional().describe('Defaults to open'),
        session: sessionArg,
      },
    },
    tool(async ({ status = 'open', session: ref }: { status?: StatusFilter; session?: string }) => {
      const { target, comments } = await commentsOf(ref, status);
      if (!comments.length && !ref) {
        const any = status === 'all' ? [] : (await client.sessionComments(target.id)).comments;
        const hint = any.length ? null : await elsewhere(target);
        if (hint) return ok(hint);
      }
      return json(comments.map(compact));
    }),
  );

  server.registerTool(
    'pointout_brief',
    {
      title: 'Pointout brief',
      description:
        'The full brief for a session, exactly what Copy for Claude would paste: one entry per ' +
        'open comment with the component, file, selector and url, then every comment as JSON ' +
        'with its id. Start here.',
      inputSchema: { session: sessionArg },
    },
    tool(async ({ session: ref }: { session?: string }) => {
      const { target, comments } = await commentsOf(ref, 'all');
      if (!comments.length) {
        const hint = ref ? null : await elsewhere(target);
        return ok(hint ?? `No comments for session ${target.name} yet.\n${STRAYS}`);
      }
      return ok(brief(comments, target.name));
    }),
  );

  server.registerTool(
    'pointout_reply',
    {
      title: 'Reply to a comment',
      description:
        'Adds a reply from Claude to a comment thread. The person sees it in the browser. ' +
        'Keep it to one line on what changed or what you need.',
      inputSchema: { id: z.string().min(1), text: z.string().min(1) },
    },
    tool(async ({ id, text }: { id: string; text: string }) =>
      json(compact(await client.reply(id, text))),
    ),
  );

  server.registerTool(
    'pointout_resolve',
    {
      title: 'Resolve comments',
      description:
        'Marks comments resolved once the fix is in. The badge turns green in the browser. ' +
        'An optional note is added as a reply on each.',
      inputSchema: {
        ids: z.array(z.string().min(1)).min(1),
        note: z.string().min(1).optional(),
      },
    },
    tool(async ({ ids, note }: { ids: string[]; note?: string }) => {
      const done = [];
      const missing: string[] = [];
      for (const id of ids) {
        try {
          if (note) await client.reply(id, note);
          done.push(compact(await client.setStatus(id, 'resolved')));
        } catch (error) {
          if (!(error instanceof HubError && error.status === 404)) throw error;
          missing.push(id);
        }
      }
      if (!missing.length) return json(done);
      const resolved = done.map((c) => c.id).join(', ') || 'nothing';
      throw new ToolError(`Unknown comment ids: ${missing.join(', ')}. Resolved: ${resolved}.`);
    }),
  );

  server.registerTool(
    'pointout_reopen',
    {
      title: 'Reopen a comment',
      description: 'Marks a resolved comment open again.',
      inputSchema: { id: z.string().min(1) },
    },
    tool(async ({ id }: { id: string }) => json(compact(await client.setStatus(id, 'open')))),
  );

  server.registerPrompt(
    'triage',
    { title: 'Triage Pointout comments', description: 'Work through every open comment.' },
    () => ({ messages: [{ role: 'user', content: { type: 'text', text: TRIAGE } }] }),
  );

  return server;
}
