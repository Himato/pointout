import type { OwnerInfo, OwnerResolver } from '@pointout/core';
import { MAX_ENTRIES, isSignal, toJsonSafe } from './json-safe';
import { getNg, type ComponentDef, type IvyDebugApi, type ViewEngineDebugApi } from './ng-globals';

const FRAMEWORK = 'angular';
const MAX_DEPTH = 50;

/** Names the Angular component behind `el`. Reads only `window.ng`, so it works on any version. */
export const angularOwnerResolver: OwnerResolver = (el) => {
  try {
    if (!(el instanceof Element) || !el.isConnected) return null;
    const ng = getNg();
    if (ng?.kind === 'ivy') return resolveIvy(ng.api, el);
    if (ng?.kind === 'view-engine') return resolveViewEngine(ng.api, el);
    return null;
  } catch {
    return null;
  }
};

function resolveIvy(ng: IvyDebugApi, el: Element): OwnerInfo | null {
  const cmp = ng.getComponent(el) ?? ng.getOwningComponent(el);
  if (!cmp) return null;
  const host = ng.getHostElement(cmp);
  const def = componentDef(cmp);

  const chain: string[] = [];
  let current = cmp;
  for (let depth = 0; depth < MAX_DEPTH && !isRouted(ng.getHostElement(current)); depth++) {
    const parent = ng.getOwningComponent(ng.getHostElement(current));
    if (!parent) break;
    chain.push(ivyName(parent));
    current = parent;
  }

  return {
    framework: FRAMEWORK,
    component: ivyName(cmp),
    chain,
    hint: selectorHint(def),
    props: ivyProps(cmp, def),
    scope: host,
  };
}

function resolveViewEngine(ng: ViewEngineDebugApi, el: Element): OwnerInfo | null {
  let dbg = ng.probe(el);
  const instance = dbg?.componentInstance;
  if (!dbg || !instance) return null;
  while (dbg.parent && dbg.parent.componentInstance === instance) dbg = dbg.parent;
  const host = dbg;

  const chain: string[] = [];
  let owner: unknown = instance;
  for (let node = host; node.parent && !isRouted(node.nativeElement); node = node.parent) {
    const next = node.parent.componentInstance;
    if (next && next !== owner) {
      chain.push(className(next));
      owner = next;
    }
  }

  return {
    framework: FRAMEWORK,
    component: className(instance),
    chain: dedupe(chain),
    hint: host.name,
    props: pickProps(Object.keys(host.properties ?? {}), (key) => host.properties?.[key]),
    scope: host.nativeElement instanceof Element ? host.nativeElement : undefined,
  };
}

function componentDef(cmp: object): ComponentDef | undefined {
  return (cmp.constructor as { ɵcmp?: ComponentDef }).ɵcmp;
}

/** Dev builds stamp the real class name on the def; esbuild may rename the class itself. */
function ivyName(cmp: object): string {
  return componentDef(cmp)?.debugInfo?.className ?? className(cmp);
}

function className(instance: unknown): string {
  return (instance as { constructor?: { name?: string } }).constructor?.name || 'Anonymous';
}

function selectorHint(def: ComponentDef | undefined): string | undefined {
  const first = def?.selectors?.[0];
  return Array.isArray(first) && first.length ? first.join('') : undefined;
}

function ivyProps(cmp: object, def: ComponentDef | undefined): Record<string, unknown> | undefined {
  const inputs = def?.inputs ?? {};
  // Older Ivy maps public name to property name, newer to [propertyName, flags, transform].
  const propertyOf = (publicName: string): string => {
    const entry = inputs[publicName];
    if (typeof entry === 'string') return entry;
    if (Array.isArray(entry) && typeof entry[0] === 'string') return entry[0];
    return publicName;
  };
  return pickProps(Object.keys(inputs), (name) => {
    const value: unknown = (cmp as Record<string, unknown>)[propertyOf(name)];
    return isSignal(value) ? value() : value;
  });
}

function pickProps(
  keys: string[],
  read: (key: string) => unknown,
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = {};
  for (const key of keys.slice(0, MAX_ENTRIES)) {
    try {
      const safe = toJsonSafe(read(key));
      if (safe !== undefined) props[key] = safe;
    } catch {
      // A getter or signal that throws just stays out of the brief.
    }
  }
  return Object.keys(props).length ? props : undefined;
}

function isRouted(host: unknown): boolean {
  return host instanceof Element && host.previousElementSibling?.localName === 'router-outlet';
}

function dedupe(names: string[]): string[] {
  return [...new Set(names)];
}
