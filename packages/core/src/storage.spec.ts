import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCommentStore, storageKey } from './storage';
import type { PointoutComment } from './types';

const comment: PointoutComment = {
  id: 'c1',
  n: 1,
  comment: 'Too much padding',
  url: '/',
  owner: null,
  domOwner: { tag: 'html', marker: 'document', name: 'document', path: 'p' },
  selector: 'p',
  tag: 'p',
  text: 'Hello',
  bbox: { x: 1, y: 2, w: 3, h: 4 },
  viewport: { w: 800, h: 600, colorScheme: 'light' },
  createdAt: '2026-10-23T09:00:00.000Z',
};

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

describe('createCommentStore', () => {
  it.each([
    ['session', () => sessionStorage],
    ['local', () => localStorage],
  ] as const)('round-trips through %s storage', (mode, backend) => {
    createCommentStore('Shop', mode).save([comment]);
    expect(backend().getItem(storageKey('Shop'))).not.toBeNull();
    expect(createCommentStore('Shop', mode).load()).toEqual([comment]);
  });

  it('keeps nothing in none mode', () => {
    const store = createCommentStore('Shop', 'none');
    store.save([comment]);
    expect(store.load()).toEqual([]);
    expect(sessionStorage.length + localStorage.length).toBe(0);
  });

  it('isolates apps by name', () => {
    createCommentStore('Shop', 'session').save([comment]);
    expect(createCommentStore('Admin', 'session').load()).toEqual([]);
    expect(storageKey('Shop')).toBe('pointout:Shop');
  });

  it('clears only its own key', () => {
    const shop = createCommentStore('Shop', 'local');
    const admin = createCommentStore('Admin', 'local');
    shop.save([comment]);
    admin.save([comment]);
    shop.clear();
    expect(shop.load()).toEqual([]);
    expect(admin.load()).toEqual([comment]);
  });

  it('swallows quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(() => createCommentStore('Shop', 'session').save([comment])).not.toThrow();
  });

  it('drops screenshots when the full list does not fit', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const store = createCommentStore('Shop', 'session');

    store.save([{ ...comment, screenshotDataUrl: 'data:image/png;base64,AAAA' }]);

    expect(store.load()).toEqual([comment]);
  });

  it('survives garbage in storage', () => {
    sessionStorage.setItem(storageKey('Shop'), '{nope');
    expect(createCommentStore('Shop', 'session').load()).toEqual([]);
  });
});
