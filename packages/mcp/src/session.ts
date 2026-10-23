import { HubError, type HubClient } from './client';
import { log } from './log';

const HEARTBEAT_MS = 10_000;

export interface SessionInfo {
  id: string;
  name: string;
  project: string;
}

export type Session = ReturnType<typeof createSession>;

function newSessionId(): string {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

/** This process's Claude session: registered at start, kept alive by heartbeats, ended on exit. */
export function createSession(client: HubClient, project: string, pid = process.pid) {
  const info: SessionInfo = { id: newSessionId(), name: '', project };
  let timer: ReturnType<typeof setInterval> | undefined;

  async function register(): Promise<void> {
    if (!info.name) {
      const live = await client.sessions();
      info.name = `${project} #${live.filter((s) => s.project === project).length + 1}`;
    }
    await client.register({ ...info, pid });
    log.debug(`session ${info.id} registered as "${info.name}"`);
  }

  async function beat(): Promise<void> {
    try {
      await client.heartbeat(info.id);
    } catch (error) {
      // A hub that took over does not know us yet.
      if (error instanceof HubError && error.status === 404) await register();
      else throw error;
    }
  }

  return {
    get info(): SessionInfo {
      return { ...info };
    },
    async start(): Promise<void> {
      client.onTakeover(register);
      await register();
      timer = setInterval(() => {
        beat().catch((error: unknown) => log.warn(`heartbeat failed: ${(error as Error).message}`));
      }, HEARTBEAT_MS);
      timer.unref();
    },
    async rename(name: string): Promise<void> {
      await client.rename(info.id, name).catch(async (error: unknown) => {
        if (!(error instanceof HubError && error.status === 404)) throw error;
        info.name = name;
        await register();
      });
      info.name = name;
    },
    async stop(): Promise<void> {
      clearInterval(timer);
      timer = undefined;
      await client.unregister(info.id).catch(() => undefined);
    },
  };
}
