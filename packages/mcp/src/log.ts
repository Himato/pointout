import { config, type LogLevel } from './config';

const rank: Record<LogLevel, number> = { silent: 0, info: 1, debug: 2 };

// stdout carries the MCP protocol. One stray byte there breaks the session, so stderr only.
function write(level: LogLevel, message: string): void {
  if (rank[config.log] >= rank[level]) process.stderr.write(`[pointout-mcp] ${message}\n`);
}

export const log = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('info', `warning: ${message}`),
  debug: (message: string) => write('debug', message),
};
