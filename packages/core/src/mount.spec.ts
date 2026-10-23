import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountPointout } from './mount';
import { addComment, click, shadowOf } from './testing';
import type { PointoutHandle } from './types';

const handles: PointoutHandle[] = [];

function mount(appName = 'Mount test'): PointoutHandle {
  const handle = mountPointout({ appName, storage: 'session' });
  handles.push(handle);
  return handle;
}

function pillIsOn(): boolean {
  const host = document.querySelector('point-out')!;
  return shadowOf(host).querySelector('.pill-toggle')?.getAttribute('aria-pressed') === 'true';
}

afterEach(() => {
  handles.splice(0).forEach((h) => h.unmount());
  document.body.innerHTML = '';
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

function ui(): ShadowRoot {
  return shadowOf(document.querySelector('point-out')!);
}

describe('mountPointout', () => {
  it('defines <point-out> once and appends it to the body', () => {
    const define = vi.spyOn(customElements, 'define');
    mount();
    mount();

    expect(customElements.get('point-out')).toBeDefined();
    expect(define.mock.calls.length).toBeLessThanOrEqual(1);
    expect(document.body.querySelectorAll('point-out')).toHaveLength(1);
  });

  it('starts off and toggles', () => {
    const handle = mount();
    expect(pillIsOn()).toBe(false);
    handle.toggle();
    expect(pillIsOn()).toBe(true);
    handle.toggle(true);
    expect(pillIsOn()).toBe(true);
    handle.toggle(false);
    expect(pillIsOn()).toBe(false);
  });

  it('toggles on the shortcut', () => {
    mount();
    const isMac = /mac/i.test(navigator.platform);
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'F',
        code: 'KeyF',
        shiftKey: true,
        [isMac ? 'metaKey' : 'ctrlKey']: true,
      }),
    );
    expect(pillIsOn()).toBe(true);
  });

  it('removes the element and every window listener on unmount', () => {
    const added = vi.spyOn(window, 'addEventListener');
    const removed = vi.spyOn(window, 'removeEventListener');
    const handle = mount();
    handle.toggle(true);
    handle.unmount();

    expect(document.querySelector('point-out')).toBeNull();
    const key = ([type, listener]: unknown[]) => [type, listener];
    expect(removed.mock.calls.map(key)).toEqual(expect.arrayContaining(added.mock.calls.map(key)));
    expect(removed.mock.calls.length).toBe(added.mock.calls.length);

    document.body.innerHTML = `<button>Page</button>`;
    const pageHandler = vi.fn();
    document.querySelector('button')!.addEventListener('click', pageHandler);
    click(document.querySelector('button')!);
    expect(pageHandler).toHaveBeenCalled();
  });

  it('round-trips comments through exportJson and storage', () => {
    document.body.innerHTML = `<main id="app"><h1>Orders</h1><p class="total">42</p></main>`;
    const handle = mount('Orders');
    handle.toggle(true);
    addComment(document.querySelector('.total')!, 'Show the currency');

    const comments = handle.getComments();
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      n: 1,
      comment: 'Show the currency',
      selector: 'p',
      text: '42',
    });
    expect(JSON.parse(handle.exportJson())).toMatchObject({ appName: 'Orders', comments });
    expect(handle.exportText()).toContain('1. [<main "Orders"> › p]');

    handle.unmount();
    expect(mount('Orders').getComments()).toEqual(comments);
  });

  it('clears comments and storage', () => {
    document.body.innerHTML = `<p>hi</p>`;
    const handle = mount();
    handle.toggle(true);
    addComment(document.querySelector('p')!, 'Bigger');
    handle.clear();

    expect(handle.getComments()).toEqual([]);
    expect(sessionStorage.getItem('pointout:Mount test')).toBeNull();
  });

  it('gives every new comment its own id', () => {
    document.body.innerHTML = `<p>a</p><span>b</span>`;
    const handle = mount();
    handle.toggle(true);
    addComment(document.querySelector('p')!, 'One');
    addComment(document.querySelector('span')!, 'Two');

    const [one, two] = handle.getComments();
    expect(one!.id).toEqual(expect.any(String));
    expect(two!.id).toEqual(expect.any(String));
    expect(one!.id).not.toBe(two!.id);
  });

  it('gives old stored comments an id on load, and keeps it', () => {
    document.body.innerHTML = `<p>hi</p>`;
    const handle = mount('Legacy');
    handle.toggle(true);
    addComment(document.querySelector('p')!, 'Old one');
    handle.unmount();
    const legacy = JSON.parse(sessionStorage.getItem('pointout:Legacy')!) as Array<{ id?: string }>;
    legacy.forEach((comment) => delete comment.id);
    sessionStorage.setItem('pointout:Legacy', JSON.stringify(legacy));

    const [loaded] = mount('Legacy').getComments();
    expect(loaded!.id).toEqual(expect.any(String));
    expect(loaded!.comment).toBe('Old one');
    expect(mount('Legacy').getComments()[0]!.id).toBe(loaded!.id);
  });

  it('opens a thread from a badge, resolves it and closes the comment popover', () => {
    document.body.innerHTML = `<p>hi</p><span>there</span>`;
    const handle = mount();
    handle.toggle(true);
    addComment(document.querySelector('p')!, 'Bigger');

    click(document.querySelector('span')!);
    const popover = ui().querySelector<HTMLElement>('.popover:not(.thread)')!;
    expect(popover.hidden).toBe(false);

    ui().querySelector<HTMLElement>('.badge')!.click();
    const thread = ui().querySelector<HTMLElement>('.thread')!;
    expect(popover.hidden).toBe(true);
    expect(thread.hidden).toBe(false);

    [...thread.querySelectorAll('button')].find((b) => b.textContent === 'Resolve')!.click();
    expect(handle.getComments()[0]!.status).toBe('resolved');
    expect(ui().querySelector('.badge')!.textContent).toBe('✓');
    expect(handle.exportText()).toContain('0 open, 1 resolved');

    [...thread.querySelectorAll('button')].find((b) => b.textContent === 'Delete')!.click();
    expect(handle.getComments()).toEqual([]);
    expect(thread.hidden).toBe(true);
  });

  it('fetches nothing unless server is set', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    mount().toggle(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the hub dot and merges what Claude said', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    document.body.innerHTML = `<p>hi</p>`;
    const replies = [{ from: 'claude', text: 'Done', at: '2026-10-23T09:00:00.000Z' }];
    const session = { id: 's1', name: 'shop #1', project: 'shop' };
    let comments: unknown[] = [];
    const fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ sessions: [session], comments }) }),
    );
    vi.stubGlobal('fetch', fetch);

    const handle = mountPointout({ appName: 'Synced', server: true });
    handles.push(handle);
    expect(ui().querySelector<HTMLElement>('.pill-sync')!.hidden).toBe(true);
    handle.toggle(true);
    addComment(document.querySelector('p')!, 'Bigger');
    await vi.waitFor(() =>
      expect(ui().querySelector('.pill-sync')!.getAttribute('data-state')).toBe('connected'),
    );
    expect(ui().querySelector('.menu')!.textContent).toContain('Claude: shop #1');

    const [mine] = handle.getComments();
    comments = [{ id: mine!.id, sessionId: 's1', status: 'resolved', replies }];
    await vi.waitFor(() => expect(handle.getComments()[0]!.status).toBe('resolved'), {
      timeout: 4_000,
    });
    expect(handle.getComments()[0]).toMatchObject({ sessionId: 's1', replies });
    expect(ui().querySelector('.toast')!.textContent).toBe('Resolved by Claude');

    // Reopening from the thread is the one push that carries a status.
    const puts = () =>
      fetch.mock.calls
        .map((call) => (call as unknown[])[1] as RequestInit | undefined)
        .filter((init) => init?.method === 'PUT')
        .map((init) => JSON.parse(init!.body as string) as { comments: { status?: string }[] });
    expect(puts().every((body) => body.comments[0]!.status === undefined)).toBe(true);
    ui().querySelector<HTMLElement>('.badge')!.click();
    const reopen = ui().querySelector<HTMLButtonElement>('.thread .btn.primary')!;
    expect(reopen.textContent).toBe('Reopen');
    reopen.click();
    await vi.waitFor(() => expect(puts().at(-1)!.comments[0]!.status).toBe('open'));
  });
});
