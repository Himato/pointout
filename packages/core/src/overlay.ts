import { everyFrame, h } from './dom';

export interface OverlayLabel {
  owner: string;
  tag: string;
}

/** The hover box. Draws over an element without ever touching the element's own styles. */
export class Overlay {
  private readonly box = h('div', 'outline');
  private readonly label = h('div', 'outline-label');
  private target: Element | null = null;
  private stopTracking: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.box.hidden = true;
    this.box.setAttribute('aria-hidden', 'true');
    this.box.append(this.label);
    parent.appendChild(this.box);
  }

  show(target: Element, label: OverlayLabel): void {
    this.target = target;
    this.label.replaceChildren(label.owner + ' ', h('span', 'tag', label.tag));
    this.box.hidden = false;
    this.place();
    this.stopTracking ??= everyFrame(() => this.place());
  }

  hide(): void {
    this.target = null;
    this.box.hidden = true;
    this.stopTracking?.();
    this.stopTracking = null;
  }

  destroy(): void {
    this.hide();
    this.box.remove();
  }

  private place(): void {
    if (!this.target?.isConnected) return this.hide();
    const rect = this.target.getBoundingClientRect();
    Object.assign(this.box.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
    this.label.classList.toggle('below', rect.top < 28);
  }
}
