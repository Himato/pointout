import { h } from './dom';
import type { SelectMode, SyncSession, SyncState } from './types';

export interface PillActions {
  toggle: () => void;
  copy: () => void;
  download: () => void;
  clear: () => void;
  setMode: (mode: SelectMode) => void;
  setSession: (id: string) => void;
  off: () => void;
}

export interface PillState {
  on: boolean;
  count: number;
  mode: SelectMode;
  sync: SyncState;
  sessions: SyncSession[];
  target: SyncSession | null;
}

/** Bottom-right switch with the pending count and hub status, plus the menu behind the dots. */
export class Pill {
  private readonly pill = h('div', 'pill');
  private readonly toggleButton = h('button', 'pill-toggle');
  private readonly count = h('span', 'pill-count', '0');
  private readonly syncDot = h('span', 'pill-sync');
  private readonly moreButton = h('button', 'pill-more', '⋯');
  private readonly menu = h('div', 'menu');
  private readonly syncRows = h('div');
  private readonly modeItems = new Map<SelectMode, HTMLButtonElement>();
  private readonly toast = h('div', 'toast');
  private copyButton: HTMLButtonElement | null = null;
  private syncKey = '';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    parent: HTMLElement,
    private readonly actions: PillActions,
  ) {
    this.toggleButton.type = 'button';
    this.syncDot.setAttribute('role', 'img');
    this.toggleButton.append(h('span', 'pill-dot'), 'Pointout', this.syncDot, this.count);
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

  render(state: PillState): void {
    this.pill.toggleAttribute('data-on', state.on);
    this.toggleButton.setAttribute('aria-pressed', String(state.on));
    this.toggleButton.title = state.on ? 'Turn Pointout off' : 'Turn Pointout on';
    this.count.textContent = String(state.count);
    this.count.setAttribute('aria-label', `${state.count} comments`);
    for (const [mode, item] of this.modeItems) {
      item.setAttribute('aria-checked', String(mode === state.mode));
    }
    this.renderSync(state);
  }

  setMenuOpen(open: boolean): void {
    this.menu.hidden = !open;
    this.moreButton.setAttribute('aria-expanded', String(open));
    if (open) this.copyButton?.focus();
  }

  flash(message: string): void {
    this.toast.textContent = message;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast.hidden = true), 1600);
  }

  private renderSync({ sync, sessions, target }: PillState): void {
    const key = JSON.stringify([sync, sessions, target?.id]);
    if (key === this.syncKey) return;
    this.syncKey = key;

    this.syncDot.hidden = sync === 'off';
    this.syncDot.dataset.state = sync;
    this.syncDot.title =
      sync === 'connected'
        ? `Hub connected${target ? `, sending to ${target.name}` : ''}`
        : 'Hub offline';
    this.syncDot.setAttribute('aria-label', this.syncDot.title);

    this.syncRows.hidden = sync === 'off';
    this.syncRows.replaceChildren(
      ...this.syncRowNodes(sync, sessions, target),
      h('div', 'menu-sep'),
    );
  }

  private syncRowNodes(sync: SyncState, sessions: SyncSession[], target: SyncSession | null) {
    if (sync === 'off') return [];
    if (sync === 'offline') return [note('Hub offline, use Copy')];
    if (!sessions.length) return [note('No Claude session, use Copy')];
    if (sessions.length === 1 && target) return [note(`Claude: ${target.name}`)];
    return [
      h('div', 'menu-label', 'Send to'),
      ...sessions.map((session) => {
        const pick = () => this.actions.setSession(session.id);
        const button = this.item(session.name, pick, 'menuitemradio');
        button.setAttribute('aria-checked', String(session.id === target?.id));
        button.title = session.project;
        return button;
      }),
    ];
  }

  private item(label: string, run: () => void, role = 'menuitem'): HTMLButtonElement {
    const button = h('button', 'menu-item', label);
    button.type = 'button';
    button.setAttribute('role', role);
    button.addEventListener('click', () => {
      this.setMenuOpen(false);
      run();
    });
    return button;
  }

  private buildMenu(): void {
    this.menu.setAttribute('role', 'menu');
    this.menu.setAttribute('aria-label', 'Pointout');
    const modeItem = (mode: SelectMode, label: string) => {
      const button = this.item(label, () => this.actions.setMode(mode), 'menuitemradio');
      this.modeItems.set(mode, button);
      return button;
    };
    this.copyButton = this.item('Copy for Claude', this.actions.copy);
    this.syncRows.hidden = true;

    this.menu.append(
      this.syncRows,
      this.copyButton,
      this.item('Download .json', this.actions.download),
      this.item('Clear', this.actions.clear),
      h('div', 'menu-sep'),
      h('div', 'menu-label', 'Mode'),
      modeItem('intercept', 'Intercept clicks'),
      modeItem('alt-click', 'Alt-click only'),
      h('div', 'menu-sep'),
      this.item('Off', this.actions.off),
    );
  }
}

function note(text: string): HTMLElement {
  return h('div', 'menu-note', text);
}
