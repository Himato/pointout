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
});

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
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'F',
        code: 'KeyF',
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
      }),
    );
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
});
