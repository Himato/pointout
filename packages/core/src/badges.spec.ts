import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Badges } from './badges';
import type { PointoutComment } from './types';

const comment = (n: number, extra: Partial<PointoutComment> = {}) =>
  ({
    id: `c${n}`,
    n,
    url: '/',
    selector: `#t${n}`,
    bbox: { x: 10, y: 10, w: 10, h: 10 },
    ...extra,
  }) as PointoutComment;

let parent: HTMLElement;
let badges: Badges;
const onOpen = vi.fn();

beforeEach(() => {
  parent = document.createElement('div');
  document.body.append(parent);
  badges = new Badges(parent, { locate: () => null, currentUrl: () => '/', onOpen });
});

afterEach(() => {
  badges.hide();
  document.body.innerHTML = '';
  onOpen.mockReset();
});

const nodes = () => [...parent.querySelectorAll<HTMLElement>('.badge')];

describe('Badges', () => {
  it('are focusable buttons that open their comment on click, Enter and Space', () => {
    const first = comment(1);
    badges.show([first]);
    const [badge] = nodes();

    expect(badge!.getAttribute('role')).toBe('button');
    expect(badge!.tabIndex).toBe(0);
    badge!.click();
    badge!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    badge!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    badge!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(onOpen).toHaveBeenCalledWith(first);
  });

  it('shows a check instead of the number once resolved', () => {
    badges.show([comment(1), comment(2, { status: 'resolved' })]);
    const [open, resolved] = nodes();

    expect(open!.textContent).toBe('1');
    expect(open!.classList.contains('resolved')).toBe(false);
    expect(resolved!.textContent).toBe('✓');
    expect(resolved!.classList.contains('resolved')).toBe(true);
    expect(resolved!.getAttribute('aria-label')).toBe('Comment 2, resolved');
  });

  it('still dims a badge whose element is gone', () => {
    badges.show([comment(1)]);
    expect(nodes()[0]!.classList.contains('gone')).toBe(true);
  });
});
