import { Badges } from './badges';
import { captureElement, defaultUrl, guardResolver, readViewport, type Capture } from './capture';
import { resolveDomOwner } from './dom-owner';
import { defaultFormatter, ownerLabel } from './format';
import { attachHitTest } from './hit-test';
import { locateComment } from './locate';
import { mergeRecords, newId, withIds, type HubRecord } from './merge';
import { Overlay } from './overlay';
import { Pill } from './pill';
import { Popover } from './popover';
import { tagWithClass } from './selector';
import { createShortcutMatcher, type ShortcutMatcher } from './shortcut';
import { createCommentStore, type CommentStore } from './storage';
import { copyText, downloadFile } from './share';
import { styles } from './styles';
import { createSync, hubUrl, type Sync } from './sync';
import { Thread } from './thread';
import type {
  OwnerInfo,
  PointoutBundle,
  PointoutComment,
  PointoutOptions,
  SelectMode,
  SyncSession,
  SyncState,
} from './types';

/** `<point-out>`: owns the state and wires the small pieces together. */
export class PointoutElement extends HTMLElement {
  private options: PointoutOptions = { appName: 'app' };
  private mode: SelectMode = 'intercept';
  private on = false;
  private comments: PointoutComment[] = [];
  private readonly liveTargets = new Map<number, WeakRef<Element>>();
  private store: CommentStore = createCommentStore('app', 'none');
  private resolveOwner: (el: Element) => OwnerInfo | null = guardResolver(undefined);
  private matchesShortcut: ShortcutMatcher = createShortcutMatcher('Mod+Shift+F');
  private hovered: Element | null = null;
  private detachHitTest: (() => void) | null = null;
  private sync: Sync | null = null;
  private syncState: SyncState = 'off';
  private sessions: SyncSession[] = [];
  private target: SyncSession | null = null;

  private readonly ui: HTMLElement;
  private readonly overlay: Overlay;
  private readonly commentPopover: Popover;
  private readonly thread: Thread;
  private readonly badges: Badges;
  private readonly pill: Pill;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    this.ui = document.createElement('div');
    this.ui.className = 'ui';
    shadow.append(style, this.ui);

    this.badges = new Badges(this.ui, {
      locate: (comment) => this.locate(comment),
      currentUrl: () => this.currentUrl(),
      onOpen: (comment) => this.openThread(comment),
    });
    this.overlay = new Overlay(this.ui);
    this.commentPopover = new Popover(this.ui);
    this.thread = new Thread(this.ui, {
      resolve: (comment) => this.setStatus(comment.id, 'resolved'),
      reopen: (comment) => this.setStatus(comment.id, 'open'),
      remove: (comment) => this.deleteComment(comment.id),
    });
    this.pill = new Pill(this.ui, {
      toggle: () => this.toggle(),
      copy: () => void this.copyForClaude(),
      download: () => this.download(),
      clear: () => this.clear(),
      setMode: (mode) => this.setMode(mode),
      setSession: (id) => this.sync?.setSession(id),
      off: () => this.toggle(false),
    });
  }

  configure(options: PointoutOptions): void {
    this.options = options;
    this.mode = options.selectMode ?? 'intercept';
    this.store = createCommentStore(options.appName, options.storage ?? 'session');
    this.resolveOwner = guardResolver(options.resolveOwner);
    this.matchesShortcut = createShortcutMatcher(options.shortcut ?? 'Mod+Shift+F');
    const stored = this.store.load();
    this.comments = withIds(stored);
    if (this.comments !== stored) this.store.save(this.comments);
    this.sync?.stop();
    this.sync = options.server ? this.createSync(options.server) : null;
    this.render();
  }

  connectedCallback(): void {
    window.addEventListener('keydown', this.onKeydown, true);
    window.addEventListener('pointerdown', this.onAnyPointerDown, true);
    this.render();
  }

  disconnectedCallback(): void {
    this.toggle(false);
    window.removeEventListener('keydown', this.onKeydown, true);
    window.removeEventListener('pointerdown', this.onAnyPointerDown, true);
  }

  toggle(on = !this.on): void {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      this.detachHitTest = attachHitTest({
        host: this,
        mode: () => this.mode,
        onHover: (el) => this.hover(el),
        onSelect: (el) => this.select(el),
      });
      this.badges.show(this.comments);
      this.sync?.start();
    } else {
      this.sync?.stop();
      this.detachHitTest?.();
      this.detachHitTest = null;
      this.commentPopover.close();
      this.thread.close();
      this.dropHover();
      this.badges.hide();
      this.pill.setMenuOpen(false);
    }
    this.render();
  }

  getComments(): PointoutComment[] {
    return JSON.parse(JSON.stringify(this.comments)) as PointoutComment[];
  }

  clear(): void {
    this.comments = [];
    this.liveTargets.clear();
    this.store.clear();
    this.refreshViews();
    this.sync?.push();
  }

  exportText(): string {
    return (this.options.formatter ?? defaultFormatter)(this.bundle());
  }

  exportJson(): string {
    return JSON.stringify(this.bundle(), null, 2);
  }

  private bundle(): PointoutBundle {
    return {
      appName: this.options.appName,
      createdAt: new Date().toISOString(),
      viewport: readViewport(),
      comments: this.getComments(),
    };
  }

  private currentUrl(): string {
    try {
      return this.options.resolveUrl?.() ?? defaultUrl();
    } catch {
      return defaultUrl();
    }
  }

  private hover(el: Element | null): void {
    if (this.commentPopover.isOpen || el === this.hovered) return;
    this.hovered = el;
    if (!el) return this.overlay.hide();
    const owner = this.resolveOwner(el);
    this.overlay.show(el, { owner: ownerLabel(owner, resolveDomOwner(el)), tag: tagWithClass(el) });
  }

  private select(el: Element): void {
    if (this.commentPopover.isOpen) return;
    this.thread.close();
    const capture = captureElement(el, this.resolveOwner(el), this.currentUrl());
    const label = ownerLabel(capture.owner, capture.domOwner);
    this.hovered = el;
    this.overlay.show(el, { owner: label, tag: tagWithClass(el) });
    this.commentPopover.open({
      anchor: el.getBoundingClientRect(),
      title: `${label} › ${capture.selector}`,
      onAdd: (comment) => void this.add(el, capture, comment),
      onCancel: () => this.dropHover(),
    });
  }

  private async add(el: Element, capture: Capture, text: string): Promise<void> {
    const n = this.comments.reduce((max, c) => Math.max(max, c.n), 0) + 1;
    const comment: PointoutComment = {
      id: newId(),
      n,
      comment: text,
      ...capture,
      createdAt: new Date().toISOString(),
    };
    this.comments = [...this.comments, comment];
    this.liveTargets.set(n, new WeakRef(el));
    this.persist();
    this.dropHover();

    const shot = await this.takeScreenshot(el);
    const stored = this.comments.find((c) => c.id === comment.id);
    if (shot && stored) {
      stored.screenshotDataUrl = shot;
      this.persist();
    }
  }

  private dropHover(): void {
    this.hovered = null;
    this.overlay.hide();
  }

  private async takeScreenshot(el: Element): Promise<string | null> {
    if (!this.options.screenshot) return null;
    try {
      return await this.options.screenshot(el);
    } catch {
      return null;
    }
  }

  /** The one write path: storage, every view, then the hub. */
  private persist(): void {
    this.store.save(this.comments);
    this.refreshViews();
    this.sync?.push();
  }

  private refreshViews(): void {
    if (this.on) this.badges.show(this.comments);
    this.thread.sync(this.comments);
    this.render();
  }

  private createSync(server: true | string): Sync {
    return createSync({
      url: hubUrl(server),
      app: this.options.appName,
      getComments: () => this.comments,
      onState: (state, sessions, target) => {
        this.syncState = state;
        this.sessions = sessions;
        this.target = target;
        this.render();
      },
      onMerge: (records) => this.merge(records),
    });
  }

  private merge(records: HubRecord[]): void {
    const result = mergeRecords(this.comments, records);
    if (!result) return;
    this.comments = result.comments;
    this.store.save(this.comments);
    this.refreshViews();
    if (result.flash) this.pill.flash(result.flash);
  }

  private openThread(comment: PointoutComment): void {
    this.commentPopover.close();
    this.dropHover();
    const live = this.locate(comment)?.getBoundingClientRect();
    const top = live?.top ?? comment.bbox.y - window.scrollY;
    const left = live?.left ?? comment.bbox.x - window.scrollX;
    this.thread.open(comment, { top, left, bottom: live?.bottom ?? top + comment.bbox.h });
  }

  private setStatus(id: string, status: 'open' | 'resolved'): void {
    this.comments = this.comments.map((c) => (c.id === id ? { ...c, status } : c));
    this.persist();
  }

  private deleteComment(id: string): void {
    const gone = this.comments.find((c) => c.id === id);
    if (gone) this.liveTargets.delete(gone.n);
    this.comments = this.comments.filter((c) => c.id !== id);
    this.persist();
  }

  private locate(comment: PointoutComment): Element | null {
    const live = this.liveTargets.get(comment.n)?.deref();
    return live?.isConnected ? live : locateComment(comment);
  }

  private setMode(mode: SelectMode): void {
    this.mode = mode;
    this.render();
  }

  private async copyForClaude(): Promise<void> {
    if (!this.comments.length) return this.pill.flash('Nothing to copy yet');
    const copied = await copyText(this.exportText());
    this.pill.flash(copied ? `Copied ${this.comments.length} for Claude` : 'Copy failed');
  }

  private download(): void {
    if (!this.comments.length) return this.pill.flash('Nothing to download yet');
    const slug = this.options.appName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadFile(
      this.ui,
      `pointout-${slug || 'app'}-${stamp}.json`,
      this.exportJson(),
      'application/json',
    );
  }

  private render(): void {
    this.pill.render({
      on: this.on,
      count: this.comments.length,
      mode: this.mode,
      sync: this.syncState,
      sessions: this.sessions,
      target: this.target,
    });
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (!this.matchesShortcut(event)) return;
    event.preventDefault();
    this.toggle();
  };

  private readonly onAnyPointerDown = (event: Event): void => {
    if (!this.pill.owns(event)) this.pill.setMenuOpen(false);
  };
}
