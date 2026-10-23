import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureElement, guardResolver } from './capture';
import { mountPointout } from './mount';
import { addComment } from './testing';
import type { PointoutHandle } from './types';

let handle: PointoutHandle | undefined;

afterEach(() => {
  handle?.unmount();
  document.body.innerHTML = '';
});

describe('a throwing resolveOwner', () => {
  it('becomes a null owner with the DOM owner still filled and one warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `
      <section aria-label="Billing"><h2>Invoices</h2><button class="pay">Pay</button><a>Help</a></section>`;
    handle = mountPointout({
      appName: 'Safety',
      storage: 'none',
      resolveOwner: () => {
        throw new Error('framework went away');
      },
    });
    handle.toggle(true);

    addComment(document.querySelector('.pay')!, 'Make it green');
    addComment(document.querySelector('a')!, 'Underline this');

    const comments = handle.getComments();
    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({
      owner: null,
      selector: '.pay',
      domOwner: {
        marker: 'landmark',
        tag: 'section',
        name: 'Billing',
        heading: 'Invoices',
        path: '.pay',
      },
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('never leaks scope or unserializable props into a capture', () => {
    document.body.innerHTML = `<app-card><b>x</b></app-card>`;
    const scope = document.querySelector('app-card')!;
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const resolve = guardResolver(() => ({
      framework: 'test',
      component: 'CardComponent',
      chain: ['CardComponent'],
      props: circular,
      scope,
    }));

    const capture = captureElement(scope.querySelector('b')!, resolve(scope), '/');

    expect(capture.owner).toEqual({
      framework: 'test',
      component: 'CardComponent',
      chain: ['CardComponent'],
    });
    expect(capture.selector).toBe('b');
  });
});
