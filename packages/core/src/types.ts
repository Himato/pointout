/** `'intercept'` takes every click while on. `'alt-click'` only takes Alt+click. */
export type SelectMode = 'intercept' | 'alt-click';
/** Where comments survive a reload. */
export type StorageMode = 'session' | 'local' | 'none';

/** What `mountPointout` accepts. Only `appName` is required. */
export interface PointoutOptions {
  /** Shown in the brief and used as the storage key. */
  appName: string;
  /** Optional framework enricher. May return null. The core guards it anyway. */
  resolveOwner?: OwnerResolver;
  /** Router hook. Defaults to `location.pathname + search + hash`. */
  resolveUrl?: () => string;
  /** Defaults to `'intercept'`. */
  selectMode?: SelectMode;
  /** Defaults to `'Mod+Shift+F'`. `Mod` is Cmd on macOS and Ctrl elsewhere. */
  shortcut?: string;
  /** Defaults to `'session'`. */
  storage?: StorageMode;
  /** Optional element screenshot. Off unless you pass one. */
  screenshot?: (el: Element) => Promise<string | null>;
  /** Defaults to `defaultFormatter`. */
  formatter?: ExportFormatter;
}

/** A framework adapter: names the component that owns `el`, or returns null. */
export type OwnerResolver = (el: Element) => OwnerInfo | null;

/** The framework's view of an element, as an adapter reports it. */
export interface OwnerInfo {
  framework: string;
  component: string;
  chain: string[];
  hint?: string;
  props?: Record<string, unknown>;
  /** Source file of the component, as the framework reports it. */
  file?: string;
  /** Selector root for this owner. Never stored or serialized. */
  scope?: Element;
}

/** The nearest framework-neutral boundary around an element. The core always fills it. */
export interface DomOwnerInfo {
  tag: string;
  marker:
    'data-component' | 'data-testid' | 'custom-element' | 'host-attr' | 'landmark' | 'document';
  name: string;
  heading?: string;
  path: string;
}

/** Turns a bundle into the text that Copy for Claude puts on the clipboard. */
export type ExportFormatter = (bundle: PointoutBundle) => string;

/** The remote control `mountPointout` returns. */
export interface PointoutHandle {
  unmount(): void;
  toggle(on?: boolean): void;
  getComments(): PointoutComment[];
  clear(): void;
  exportText(): string;
  exportJson(): string;
}

/** One comment, with everything needed to find the element again. */
export interface PointoutComment {
  n: number;
  comment: string;
  url: string;
  owner: Omit<OwnerInfo, 'scope'> | null;
  domOwner: DomOwnerInfo;
  selector: string;
  /**
   * Document-unique selector of the element `selector` is relative to: the owner's host, or the
   * shadow host when the element lives in a shadow root. Absent when `selector` is document-wide.
   */
  anchor?: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  viewport: { w: number; h: number; colorScheme: 'light' | 'dark' };
  createdAt: string;
  screenshotDataUrl?: string;
}

/** Everything an export contains. */
export interface PointoutBundle {
  appName: string;
  createdAt: string;
  viewport: PointoutComment['viewport'];
  comments: PointoutComment[];
}
