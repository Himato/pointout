import type { AddressInfo } from 'node:net';
import { log } from '../log';
import { createHubServer } from './server';
import { createSessions } from './sessions';
import { createStore } from './store';

export const HOST = '127.0.0.1';

export interface HubOptions {
  port: number;
  home: string;
  pid?: number;
}

export interface Hub {
  port: number;
  pid: number;
  close(): Promise<void>;
}

export type ListenResult =
  { status: 'hub'; hub: Hub } | { status: 'taken-by-pointout' } | { status: 'taken-by-other' };

/** Tries to become the hub. Losing the race to another Pointout is fine, losing it to anyone else is not. */
export async function tryListen(options: HubOptions): Promise<ListenResult> {
  const pid = options.pid ?? process.pid;
  const store = createStore(options.home);
  const sessions = createSessions(store);
  let port = options.port;
  const server = createHubServer({ store, sessions, pid, port: () => port });

  const bound = await new Promise<boolean>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) =>
      error.code === 'EADDRINUSE' ? resolve(false) : reject(error),
    );
    server.listen(options.port, HOST, () => resolve(true));
  });

  if (!bound) {
    const status = (await isPointout(options.port)) ? 'taken-by-pointout' : 'taken-by-other';
    log.debug(`port ${options.port} is ${status}`);
    return { status };
  }

  port = (server.address() as AddressInfo).port;
  store.removeStaleTemps();
  sessions.start();
  log.info(`hub listening on http://${HOST}:${port}, store ${options.home}`);
  return {
    status: 'hub',
    hub: {
      port,
      pid,
      close: () =>
        new Promise<void>((resolve) => {
          sessions.stop();
          server.close(() => resolve());
          server.closeAllConnections();
        }),
    },
  };
}

/** True when whoever holds the port answers `/health` like a Pointout hub. A busy hub gets a second try. */
async function isPointout(port: number): Promise<boolean> {
  if (await probe(port)) return true;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return probe(port);
}

async function probe(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}:${port}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    const body = (await res.json()) as { ok?: unknown; version?: unknown };
    return body.ok === true && typeof body.version === 'string';
  } catch {
    return false;
  }
}
