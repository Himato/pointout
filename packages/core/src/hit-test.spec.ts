import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachHitTest } from './hit-test';
import { click } from './testing';
import type { SelectMode } from './types';

let host: HTMLElement;
let ownButton: HTMLButtonElement;
let pageButton: HTMLButtonElement;
let detach: () => void = () => {};

beforeEach(() => {
  document.body.innerHTML = `<button id="page">Page</button><point-out></point-out>`;
  host = document.querySelector('point-out')!;
  ownButton = document.createElement('button');
  host.attachShadow({ mode: 'open' }).append(ownButton);
  pageButton = document.querySelector('#page')!;
});

afterEach(() => {
  detach();
  document.body.innerHTML = '';
});

function start(mode: SelectMode) {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  detach = attachHitTest({ host, mode: () => mode, onHover, onSelect });
  return { onSelect, onHover };
}

describe('attachHitTest', () => {
  it('finds the real target inside an open shadow root', () => {
    const { onSelect, onHover } = start('intercept');
    const card = document.createElement('x-card');
    document.body.append(card);
    const inner = document.createElement('span');
    card.attachShadow({ mode: 'open' }).append(inner);

    inner.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, composed: true }));
    click(inner);

    expect(onHover).toHaveBeenCalledWith(inner);
    expect(onSelect).toHaveBeenCalledWith(inner);
  });

  it('ignores our own UI', () => {
    const { onSelect } = start('intercept');
    const ownHandler = vi.fn();
    ownButton.addEventListener('click', ownHandler);

    const event = click(ownButton);

    expect(onSelect).not.toHaveBeenCalled();
    expect(ownHandler).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('stops the page handler in intercept mode', () => {
    const { onSelect } = start('intercept');
    const pageHandler = vi.fn();
    const presses = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick'];
    for (const type of [...presses, 'click']) pageButton.addEventListener(type, pageHandler);

    for (const type of presses) {
      pageButton.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    }
    const event = click(pageButton);

    expect(pageHandler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(pageButton);
  });

  it('lets plain clicks through in alt-click mode and takes alt-clicks', () => {
    const { onSelect } = start('alt-click');
    const pageHandler = vi.fn();
    pageButton.addEventListener('click', pageHandler);

    click(pageButton);
    expect(pageHandler).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();

    click(pageButton, { altKey: true });
    expect(pageHandler).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(pageButton);
  });

  it('stops listening once detached', () => {
    const { onSelect } = start('intercept');
    detach();
    const pageHandler = vi.fn();
    pageButton.addEventListener('click', pageHandler);

    click(pageButton);

    expect(pageHandler).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
