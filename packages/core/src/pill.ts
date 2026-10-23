import { h } from './dom';
import type { SelectMode } from './types';

export interface PillActions {
  toggle: () => void;
  copy: () => void;
  download: () => void;
  clear: () => void;
  setMode: (mode: SelectMode) => void;
  off: () => void;
}

/** Bottom-right switch with the pending count, plus the menu behind the dots. */
export class Pill {
  private readonly pill = h('div', 'pill');
  private readonly toggleButton = h('button', 'pill-toggle');
  private readonly count = h('span', 'pill-count', '0');
  private readonly moreButton = h('button', 'pill-more', '⋯');
  private readonly menu = h('div', 'menu');
  private readonly modeItems = new Map<SelectMode, HTMLButtonElement>();
  private readonly toast = h('div', 'toast');
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    parent: HTMLElement,
    private readonly actions: PillActions,
  ) {
    this.toggleButton.type = 'button';
    this.toggleButton.append(h('span', 'pill-dot'), 'Pointout', this.count);
    this.moreButton.type = 'button';
    this.moreButton.setAttribute('aria-label', 'Pointout menu');
    this.moreButton.setAttribute('aria-haspopup', 'menu');
    this.pill.append(this.toggleButton, this.moreButton);

    this.buildMenu();
    this.toast.hidden = true;
    this.toast.setAttribute('role', 'status');
    parent.append(this.pill, this.menu, this.toast);

    this.toggleButton.addEventListener('click', () => actions.toggle());
    this.moreButton.addEventListener('click', () => this.setMenuOpen(this.menu.hidden !== false));
    this.menu.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      this.setMenuOpen(false);
      this.moreButton.focus();
    });
    this.setMenuOpen(false);
  }

  /** True when the event happened inside the pill or its menu. */
  owns(event: Event): boolean {
    const path = event.composedPath();
    return path.includes(this.pill) || path.includes(this.menu);
  }

  render(state: { on: boolean; count: number; mode: SelectMode }): void {
    this.pill.toggleAttribute('data-on', state.on);
    this.toggleButton.setAttribute('aria-pressed', String(state.on));
    this.toggleButton.title = state.on ? 'Turn Pointout off' : 'Turn Pointout on';
    this.count.textContent = String(state.count);
    this.count.setAttribute('aria-label', `${state.count} comments`);
    for (const [mode, item] of this.modeItems) {
      item.setAttribute('aria-checked', String(mode === state.mode));
    }
  }

  setMenuOpen(open: boolean): void {
    this.menu.hidden = !open;
    this.moreButton.setAttribute('aria-expanded', String(open));
    if (open) this.menu.querySelector('button')?.focus();
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1600);
  }

  private buildMenu(): void {
    this.menu.setAttribute('role', 'menu');
    this.menu.setAttribute('aria-label', 'Pointout');
    const item = (label: string, run: () => void, role = 'menuitem') => {
      const button = h('button', 'menu-item', label);
      button.type = 'button';
      button.setAttribute('role', role);
      button.addEventListener('click', () => {
        this.setMenuOpen(false);
        run();
      });
      return button;
    };
    const modeItem = (mode: SelectMode, label: string) => {
      const button = item(label, () => this.actions.setMode(mode), 'menuitemradio');
      this.modeItems.set(mode, button);
      return button;
    };

    this.menu.append(
      item('Copy for Claude', this.actions.copy),
      item('Download .json', this.actions.download),
      item('Clear', this.actions.clear),
      h('div', 'menu-sep'),
      h('div', 'menu-label', 'Mode'),
      modeItem('intercept', 'Intercept clicks'),
      modeItem('alt-click', 'Alt-click only'),
      h('div', 'menu-sep'),
      item('Off', this.actions.off),
    );
  }
}
