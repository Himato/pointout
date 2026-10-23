import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createClient, type HubClient } from './client';
import { config } from './config';
import { HOST } from './hub/start';
import { log } from './log';
import { createMcpServer } from './mcp';
import { createSession } from './session';
import { VERSION } from './version';

const USAGE = `pointout-mcp ${VERSION}

Usage:
  pointout-mcp           MCP server over stdio, and the hub if the port is free
  pointout-mcp serve     the hub alone
  pointout-mcp --help    this text
  pointout-mcp --version

Env: POINTOUT_PORT (7331), POINTOUT_HOME (~/.pointout), POINTOUT_PROJECT (cwd name), POINTOUT_LOG (info|debug|silent)
`;

async function startHub(client: HubClient): Promise<void> {
  try {
    await client.ensureHub();
  } catch (error) {
    log.info((error as Error).message);
    process.exit(1);
  }
}

async function serve(): Promise<void> {
  const client = createClient(config);
  await startHub(client);
  if (!client.hub) {
    log.info(`a hub already runs on http://${HOST}:${config.port}, nothing to do`);
    process.exit(0);
  }
  const stop = () => void client.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

async function mcp(): Promise<void> {
  const client = createClient(config);
  await startHub(client);
  const session = createSession(client, config.project);
  await session.start();
  log.info(`session ${session.info.id} "${session.info.name}" in ${config.project}`);

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void session
      .stop()
      .then(() => client.close())
      .finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  // Claude Code closes our stdin when the chat ends.
  process.stdin.on('end', stop);
  process.stdin.on('close', stop);

  await createMcpServer(client, session).connect(new StdioServerTransport());
}

const [arg, ...rest] = process.argv.slice(2);
if (rest.length) {
  process.stderr.write(USAGE);
  process.exit(1);
}
switch (arg) {
  case undefined:
    await mcp();
    break;
  case 'serve':
    await serve();
    break;
  case '--help':
  case '-h':
    process.stdout.write(USAGE);
    break;
  case '--version':
    process.stdout.write(`${VERSION}\n`);
    break;
  default:
    process.stderr.write(USAGE);
    process.exit(1);
}
