import { h, placeNear, type Anchor } from './dom';
import { trapTab } from './focus-trap';
import { ownerLabel } from './format';
import type { PointoutComment, PointoutReply } from './types';

export interface ThreadActions {
  resolve: (comment: PointoutComment) => void;
  reopen: (comment: PointoutComment) => void;
  remove: (comment: PointoutComment) => void;
}

/** Read-only view of one comment and what Claude said about it. Esc closes. */
export class Thread {
  private readonly panel = h('div', 'popover thread');
  private readonly title = h('p', 'popover-title');
  private readonly body = h('p', 'thread-comment');
  private readonly replies = h('div', 'thread-replies');
  private readonly status = h('p', 'thread-status');
  private readonly deleteButton = h('button', 'btn thread-delete', 'Delete');
  private readonly closeButton = h('button', 'btn', 'Close');
  private readonly statusButton = h('button', 'btn primary');
  private comment: PointoutComment | null = null;
  private returnFocus: HTMLElement | null = null;

  constructor(
    parent: HTMLElement,
    private readonly actions: ThreadActions,
  ) {
    this.panel.hidden = true;
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'true');
    this.panel.setAttribute('aria-label', 'Pointout comment thread');
    for (const button of [this.deleteButton, this.closeButton, this.statusButton]) {
      button.type = 'button';
    }

    const buttons = h('div', 'popover-actions');
    buttons.append(this.deleteButton, this.closeButton, this.statusButton);
    this.panel.append(this.title, this.body, this.replies, this.status, buttons);
    parent.appendChild(this.panel);

    this.statusButton.addEventListener('click', () =>
      this.run(this.isResolved ? 'reopen' : 'resolve'),
    );
    this.deleteButton.addEventListener('click', () => this.run('remove'));
    this.closeButton.addEventListener('click', () => this.close());
    this.panel.addEventListener('keydown', (event) => this.onKeydown(event));
  }

  get isOpen(): boolean {
    return this.comment !== null;
  }

  open(comment: PointoutComment, anchor: Anchor): void {
    if (!this.comment) {
      this.returnFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this.render(comment);
    this.panel.hidden = false;
    placeNear(this.panel, anchor);
    this.statusButton.focus();
  }

  /** Follows the open comment through edits and merges, and closes when it is gone. */
  sync(comments: PointoutComment[]): void {
    if (!this.comment) return;
    const id = this.comment.id;
    const fresh = comments.find((c) => c.id === id);
    if (fresh) this.render(fresh);
    else this.close();
  }

  close(): void {
    if (!this.comment) return;
    this.comment = null;
    this.panel.hidden = true;
    this.returnFocus?.focus?.();
    this.returnFocus = null;
  }

  private get isResolved(): boolean {
    return this.comment?.status === 'resolved';
  }

  private render(comment: PointoutComment): void {
    this.comment = comment;
    const label = `${comment.n}. ${ownerLabel(comment.owner, comment.domOwner)} › ${comment.selector}`;
    this.title.textContent = label;
    this.title.title = label;
    this.body.textContent = comment.comment;
    this.replies.replaceChildren(...(comment.replies ?? []).map(replyNode));
    this.status.textContent = this.isResolved ? 'Resolved' : 'Open';
    this.panel.toggleAttribute('data-resolved', this.isResolved);
    this.statusButton.textContent = this.isResolved ? 'Reopen' : 'Resolve';
  }

  private run(action: keyof ThreadActions): void {
    if (this.comment) this.actions[action](this.comment);
  }

  private onKeydown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Tab') {
      trapTab(event, [this.deleteButton, this.closeButton, this.statusButton]);
    }
  }
}

function replyNode(reply: PointoutReply): HTMLElement {
  const node = h('div', 'thread-reply');
  const who = reply.from === 'claude' ? 'Claude' : 'You';
  node.append(h('div', 'thread-meta', `${who} · ${shortTime(reply.at)}`), h('div', '', reply.text));
  return node;
}

function shortTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}
