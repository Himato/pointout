import { afterEach, describe, expect, it } from 'vitest';
import { mountPointout } from './mount';
import { shadowOf } from './testing';
import type { PointoutHandle } from './types';

let handle: PointoutHandle | undefined;

afterEach(() => {
  handle?.unmount();
  handle = undefined;
  document.documentElement.dir = '';
  document.body.innerHTML = '';
  sessionStorage.clear();
});

describe('RTL pages', () => {
  it('keeps the Pointout UI left to right', () => {
    document.documentElement.dir = 'rtl';
    handle = mountPointout({ appName: 'RTL test', storage: 'session' });

    const host = document.querySelector('point-out')!;
    const css = shadowOf(host).querySelector('style')?.textContent ?? '';
    const hostRule = css.slice(css.indexOf(':host {'), css.indexOf('}'));

    expect(host.getAttribute('dir')).toBe('ltr');
    expect(hostRule).toContain('direction: ltr;');
    expect(document.documentElement.dir).toBe('rtl');
  });
});
