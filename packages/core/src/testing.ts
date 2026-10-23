// Test helpers shared by the specs. Not part of the package.

export function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', {
    bubbles: true,
    composed: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

export function shadowOf(host: Element): ShadowRoot {
  if (!host.shadowRoot) throw new Error('expected an open shadow root');
  return host.shadowRoot;
}

/** Clicks `target` while Pointout is on, types `text` into the popover and presses Enter. */
export function addComment(target: Element, text: string): void {
  click(target);
  const host = document.querySelector('point-out');
  const input = host && shadowOf(host).querySelector('textarea');
  if (!input) throw new Error('popover did not open');
  input.value = text;
  input.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
  );
}
