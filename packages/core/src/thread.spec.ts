import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Thread } from './thread';
import type { PointoutComment } from './types';

const anchor = { top: 100, bottom: 120, left: 40 };
const base = {
  id: 'c1',
  n: 3,
  comment: 'Header should stick',
  owner: { framework: 'angular', component: 'AlertsTableComponent', chain: [] },
  domOwner: { tag: 'section', marker: 'landmark', name: 'alerts', path: 'table' },
  selector: '#alerts-tbl',
} as unknown as PointoutComment;

let root: ShadowRoot;
let thread: Thread;
const actions = { resolve: vi.fn(), reopen: vi.fn(), remove: vi.fn() };

const panel = () => root.querySelector<HTMLElement>('.thread')!;
const button = (label: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === label)!;
const key = (target: Element, init: KeyboardEventInit) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, composed: true, ...init }));

beforeEach(() => {
  const host = document.createElement('div');
  document.body.append(host);
  root = host.attachShadow({ mode: 'open' });
  const parent = document.createElement('div');
  root.append(parent);
  thread = new Thread(parent, actions);
});

afterEach(() => {
  document.body.innerHTML = '';
  Object.values(actions).forEach((fn) => fn.mockReset());
});

describe('Thread', () => {
  it('shows the label, the comment, every reply and the status', () => {
    thread.open(
      {
        ...base,
        replies: [
          { from: 'claude', text: 'Made it sticky', at: '2026-10-23T09:00:00.000Z' },
          { from: 'user', text: 'Thanks', at: 'not a date' },
        ],
      },
      anchor,
    );

    expect(panel().hidden).toBe(false);
    expect(root.querySelector('.popover-title')!.textContent).toBe(
      '3. AlertsTableComponent › #alerts-tbl',
    );
    expect(root.querySelector('.thread-comment')!.textContent).toBe('Header should stick');
    const replies = [...root.querySelectorAll('.thread-reply')].map((r) => r.textContent);
    expect(replies).toHaveLength(2);
    expect(replies[0]).toMatch(/^Claude · .+Made it sticky$/);
    expect(replies[1]).toBe('You · not a dateThanks');
    expect(root.querySelector('.thread-status')!.textContent).toBe('Open');
  });

  it('offers Resolve on an open comment and Reopen on a resolved one', () => {
    thread.open(base, anchor);
    button('Resolve').click();
    expect(actions.resolve).toHaveBeenCalledWith(base);

    const resolved = { ...base, status: 'resolved' as const };
    thread.sync([resolved]);
    expect(root.querySelector('.thread-status')!.textContent).toBe('Resolved');
    button('Reopen').click();
    expect(actions.reopen).toHaveBeenCalledWith(resolved);

    button('Delete').click();
    expect(actions.remove).toHaveBeenCalledWith(resolved);
  });

  it('closes on Esc and when its comment is gone', () => {
    thread.open(base, anchor);
    key(panel(), { key: 'Escape' });
    expect(panel().hidden).toBe(true);
    expect(thread.isOpen).toBe(false);

    thread.open(base, anchor);
    thread.sync([]);
    expect(panel().hidden).toBe(true);
  });

  it('keeps Tab inside the panel', () => {
    thread.open(base, anchor);
    const order = ['Delete', 'Close', 'Resolve'];
    expect(root.activeElement).toBe(button('Resolve'));

    for (const label of order) {
      key(root.activeElement!, { key: 'Tab' });
      expect(root.activeElement).toBe(button(label));
    }
    key(root.activeElement!, { key: 'Tab', shiftKey: true });
    expect(root.activeElement).toBe(button('Close'));
  });
});
