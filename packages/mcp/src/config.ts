import { homedir } from 'node:os';
import { basename, join } from 'node:path';

export type LogLevel = 'silent' | 'info' | 'debug';

export interface Config {
  port: number;
  home: string;
  project: string;
  log: LogLevel;
}

export const DEFAULT_PORT = 7331;

/** Folder safe: lowercase, `[a-z0-9._-]` only, never empty, never a dot path. */
export function projectName(raw: string): string {
  const name = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|-+$/g, '');
  return name || 'default';
}

export function readConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): Config {
  const port = Number(env.POINTOUT_PORT);
  const log = env.POINTOUT_LOG;
  return Object.freeze({
    port: Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT,
    home: env.POINTOUT_HOME || join(homedir(), '.pointout'),
    project: projectName(env.POINTOUT_PROJECT || basename(cwd)),
    log: log === 'debug' || log === 'silent' ? log : 'info',
  });
}

export const config: Config = readConfig();
