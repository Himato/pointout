export type SelectMode = 'intercept' | 'alt-click';
export type StorageMode = 'session' | 'local' | 'none';

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

export type OwnerResolver = (el: Element) => OwnerInfo | null;

export interface OwnerInfo {
  framework: string;
  component: string;
  chain: string[];
  hint?: string;
  props?: Record<string, unknown>;
  /** Selector root for this owner. Never stored or serialized. */
  scope?: Element;
}

export interface DomOwnerInfo {
  tag: string;
  marker:
    'data-component' | 'data-testid' | 'custom-element' | 'host-attr' | 'landmark' | 'document';
  name: string;
  heading?: string;
  path: string;
}

export type ExportFormatter = (bundle: PointoutBundle) => string;

export interface PointoutHandle {
  unmount(): void;
  toggle(on?: boolean): void;
  getComments(): PointoutComment[];
  clear(): void;
  exportText(): string;
  exportJson(): string;
}

export interface PointoutComment {
  n: number;
  comment: string;
  url: string;
  owner: Omit<OwnerInfo, 'scope'> | null;
  domOwner: DomOwnerInfo;
  selector: string;
  tag: string;
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  viewport: { w: number; h: number; colorScheme: 'light' | 'dark' };
  createdAt: string;
  screenshotDataUrl?: string;
}

export interface PointoutBundle {
  appName: string;
  createdAt: string;
  viewport: PointoutComment['viewport'];
  comments: PointoutComment[];
}
