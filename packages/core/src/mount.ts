import { TAG_NAME } from './dom';
import { PointoutElement } from './element';
import type { PointoutHandle, PointoutOptions } from './types';

const NOOP_HANDLE: PointoutHandle = {
  unmount() {},
  toggle() {},
  getComments: () => [],
  clear() {},
  exportText: () => '',
  exportJson: () => '',
};

/**
 * Adds `<point-out>` to the page and hands back a remote control.
 * Mounting again replaces the previous instance. Outside a browser it does nothing.
 */
export function mountPointout(options: PointoutOptions): PointoutHandle {
  if (typeof document === 'undefined' || typeof customElements === 'undefined') {
    return NOOP_HANDLE;
  }
  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, PointoutElement);

  const element = document.createElement(TAG_NAME);
  if (!(element instanceof PointoutElement)) {
    console.warn(`[pointout] <${TAG_NAME}> is already defined by another copy of @point-out/core.`);
    return NOOP_HANDLE;
  }
  for (const previous of document.querySelectorAll(TAG_NAME)) previous.remove();
  element.configure(options);
  appendWhenReady(element);

  return {
    unmount: () => element.remove(),
    toggle: (on) => element.toggle(on),
    getComments: () => element.getComments(),
    clear: () => element.clear(),
    exportText: () => element.exportText(),
    exportJson: () => element.exportJson(),
  };
}

function appendWhenReady(element: Element): void {
  if (document.body) {
    document.body.append(element);
    return;
  }
  document.addEventListener('DOMContentLoaded', () => document.body.append(element), {
    once: true,
  });
}
