import type { IncomingMessage, ServerResponse } from 'node:http';

export const MAX_BODY = 10 * 1024 * 1024;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname);
}

/** Hostname of an origin or a Host header, or null when it does not parse. */
export function hostnameOf(value: string, withScheme: boolean): string | null {
  try {
    return new URL(withScheme ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(text);
}

export function sendText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

export function sendEmpty(res: ServerResponse, status = 204): void {
  res.writeHead(status);
  res.end();
}

/** Reads a JSON body up to `MAX_BODY`. Screenshots make 10 MB a fair ceiling. */
export async function readJson(req: IncomingMessage): Promise<unknown> {
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) {
    req.resume();
    throw new HttpError(413, `Body over ${MAX_BODY} bytes`);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size <= MAX_BODY) chunks.push(chunk);
  }
  if (size > MAX_BODY) throw new HttpError(413, `Body over ${MAX_BODY} bytes`);
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}
