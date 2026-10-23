/** Angular's dev-mode globals on `window.ng`. Typed loosely on purpose: shapes drift between versions. */

export interface ComponentDef {
  selectors?: unknown[][];
  inputs?: Record<string, unknown>;
  debugInfo?: { className?: string; filePath?: string };
}

export interface IvyDebugApi {
  getComponent(el: Element): object | null;
  getOwningComponent(elOrDir: Element | object): object | null;
  getHostElement(componentOrDirective: object): Element;
}

export interface DebugElement {
  name?: string;
  nativeElement?: unknown;
  componentInstance?: unknown;
  properties?: Record<string, unknown>;
  parent?: DebugElement | null;
}

export interface ViewEngineDebugApi {
  probe(el: Element): DebugElement | null;
}

export type NgGlobals =
  { kind: 'ivy'; api: IvyDebugApi } | { kind: 'view-engine'; api: ViewEngineDebugApi };

export function getNg(): NgGlobals | null {
  if (typeof window === 'undefined') return null;
  const ng = (window as { ng?: Partial<IvyDebugApi & ViewEngineDebugApi> }).ng;
  if (!ng) return null;
  if (typeof ng.getOwningComponent === 'function') return { kind: 'ivy', api: ng as IvyDebugApi };
  if (typeof ng.probe === 'function') return { kind: 'view-engine', api: ng as ViewEngineDebugApi };
  return null;
}
