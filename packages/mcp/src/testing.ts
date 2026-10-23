import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { HubComment } from './hub/store';

export function tempHome(): { home: string; cleanup: () => void } {
  const home = mkdtempSync(join(tmpdir(), 'pointout-mcp-'));
  return { home, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}

/** A port that was free a moment ago. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

export function hubComment(id: string, extra: Partial<HubComment> = {}): HubComment {
  return {
    id,
    app: 'Shop',
    n: 1,
    comment: 'Make it bigger',
    url: '/cart',
    owner: { framework: 'angular', component: 'CartComponent', chain: [], file: 'cart.ts' },
    domOwner: { tag: 'section', marker: 'landmark', name: 'Cart', path: 'main > section' },
    selector: 'button.pay',
    tag: 'button',
    text: 'Pay',
    bbox: { x: 1, y: 2, w: 3, h: 4 },
    viewport: { w: 1280, h: 800, colorScheme: 'light' },
    createdAt: '2026-10-23T09:00:00.000Z',
    ...extra,
  };
}
