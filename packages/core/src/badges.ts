import { everyFrame, h } from './dom';
import type { PointoutComment } from './types';

export interface BadgeSources {
  /** Finds the live element for a comment, or null when it is not on the page. */
  locate: (comment: PointoutComment) => Element | null;
  currentUrl: () => string;
  /** A badge was clicked or activated from the keyboard. */
  onOpen: (comment: PointoutComment) => void;
}

interface Badge {
  comment: PointoutComment;
  node: HTMLElement;
  target: Element | null;
}

const RELOCATE_EVERY_FRAMES = 30;

/**
 * Numbered markers on commented elements, a check once resolved. Dimmed at the old spot when the
 * element is gone. Each one opens its thread.
 */
export class Badges {
  private readonly layer = h('div');
  private badges: Badge[] = [];
  private lastUrl = '';
  private frame = 0;
  private stopTracking: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly sources: BadgeSources,
  ) {
    parent.appendChild(this.layer);
  }

  show(comments: PointoutComment[]): void {
    this.layer.replaceChildren();
    this.badges = comments.map((comment) => {
      const node = this.badgeNode(comment);
      this.layer.append(node);
      return { comment, node, target: null };
    });
    this.lastUrl = '';
    this.update();
    this.stopTracking ??= everyFrame(() => this.update());
  }

  hide(): void {
    this.stopTracking?.();
    this.stopTracking = null;
    this.badges = [];
    this.layer.replaceChildren();
  }

  private badgeNode(comment: PointoutComment): HTMLElement {
    const resolved = comment.status === 'resolved';
    const node = h(
      'div',
      resolved ? 'badge resolved' : 'badge',
      resolved ? '✓' : String(comment.n),
    );
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    node.setAttribute('aria-label', `Comment ${comment.n}${resolved ? ', resolved' : ''}`);
    node.addEventListener('click', () => this.sources.onOpen(comment));
    node.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.sources.onOpen(comment);
    });
    return node;
  }

  private update(): void {
    const url = this.sources.currentUrl();
    const relocate = url !== this.lastUrl || this.frame++ % RELOCATE_EVERY_FRAMES === 0;
    this.lastUrl = url;

    for (const badge of this.badges) {
      const onThisPage = badge.comment.url === url;
      badge.node.hidden = !onThisPage;
      if (!onThisPage) continue;
      if (relocate) badge.target = this.sources.locate(badge.comment);
      this.place(badge);
    }
  }

  private place({ comment, node, target }: Badge): void {
    const live = target?.isConnected ? target.getBoundingClientRect() : null;
    const x = live ? live.left : comment.bbox.x - window.scrollX;
    const y = live ? live.top : comment.bbox.y - window.scrollY;
    node.classList.toggle('gone', !live);
    node.style.left = `${Math.max(2, x - 8)}px`;
    node.style.top = `${Math.max(2, y - 8)}px`;
  }
}
