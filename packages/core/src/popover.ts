import { h } from './dom';

export interface PopoverRequest {
  anchor: DOMRect;
  title: string;
  onAdd: (comment: string) => void;
  onCancel: () => void;
}

const GAP = 8;
const EDGE = 8;

/** Comment box anchored to the selected element. Enter adds, Shift+Enter breaks a line, Esc cancels. */
export class Popover {
  private readonly panel = h('div', 'popover');
  private readonly title = h('p', 'popover-title');
  private readonly input = h('textarea');
  private readonly addButton = h('button', 'btn primary', 'Add');
  private readonly cancelButton = h('button', 'btn', 'Cancel');
  private request: PopoverRequest | null = null;
  private returnFocus: HTMLElement | null = null;

  constructor(parent: HTMLElement) {
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-label', 'Add a Pointout comment');
    this.input.placeholder = 'What should change here?';
    this.input.setAttribute('aria-label', 'Comment');
    this.addButton.type = 'button';
    this.cancelButton.type = 'button';

    const actions = h('div', 'popover-actions');
    actions.append(h('span', 'popover-hint', 'Enter adds, Shift+Enter for a new line'));
    actions.append(this.cancelButton, this.addButton);
    this.panel.append(this.title, this.input, actions);
    parent.appendChild(this.panel);

    this.addButton.addEventListener('click', () => this.submit());
    this.cancelButton.addEventListener('click', () => this.cancel());
    this.panel.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  get isOpen(): boolean {
    return this.request !== null;
  }

  open(request: PopoverRequest): void {
    this.request = request;
    this.returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.title.textContent = request.title;
    this.title.title = request.title;
    this.input.value = '';
    this.panel.hidden = false;
    this.place(request.anchor);
    this.input.focus();
  }

  /** Closes without calling either callback. */
  close(): void {
    if (!this.request) return;
    this.request = null;
    this.panel.hidden = true;
    this.returnFocus?.focus?.();
    this.returnFocus = null;
  }

  private submit(): void {
    const comment = this.input.value.trim();
    const request = this.request;
    if (!comment || !request) return this.input.focus();
    this.close();
    request.onAdd(comment);
  }

  private cancel(): void {
    const request = this.request;
    this.close();
    request?.onCancel();
  }

  private onKeydown(event: KeyboardEvent): void {
    // Keep keystrokes away from page-level shortcuts while typing.
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      if (event.target !== this.input) return;
      event.preventDefault();
      this.submit();
    } else if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  private trapFocus(event: KeyboardEvent): void {
    const stops: HTMLElement[] = [this.input, this.cancelButton, this.addButton];
    const active = (this.panel.getRootNode() as ShadowRoot).activeElement;
    const index = stops.indexOf(active as HTMLElement);
    const next = (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
    event.preventDefault();
    stops[next]?.focus();
  }

  /** Below the element when it fits, above when it does not, always inside the viewport. */
  private place(anchor: DOMRect): void {
    const { innerWidth: vw, innerHeight: vh } = window;
    const width = this.panel.offsetWidth || 320;
    const height = this.panel.offsetHeight || 160;

    let top = anchor.bottom + GAP;
    if (top + height > vh - EDGE) top = anchor.top - GAP - height;
    top = clamp(top, EDGE, vh - height - EDGE);
    const left = clamp(anchor.left, EDGE, vw - width - EDGE);

    this.panel.style.top = `${top}px`;
    this.panel.style.left = `${left}px`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}
