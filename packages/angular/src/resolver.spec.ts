import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DebugElement } from './ng-globals';
import { angularOwnerResolver } from './resolver';

const SIGNAL = Symbol('SIGNAL');

function signal<T>(value: T): () => T {
  return Object.assign(() => value, { [SIGNAL]: { value } });
}

function component(name: string, selector: string, inputs: Record<string, unknown> = {}) {
  const ctor = { [name]: class {} }[name]!;
  Object.assign(ctor, { ɵcmp: { selectors: [[selector]], inputs } });
  return ctor;
}

const AppRoot = component('AppRoot', 'app-root');
const AppPage = component('AppPage', 'app-page');
const AppCard = component('AppCard', 'app-card', {
  title: 'title',
  size: ['size', 0, null],
  tags: ['tags', 0, null],
  onPick: ['onPick', 0, null],
  owner: ['owner', 0, null],
  stream: ['stream', 0, null],
  broken: ['broken', 0, null],
});

let root: HTMLElement;
let page: HTMLElement;
let card: HTMLElement;
let button: HTMLButtonElement;
let instances: Map<Element, object>;

function buildDom(withOutlet: boolean): void {
  document.body.innerHTML = `
    <app-root>
      ${withOutlet ? '<router-outlet></router-outlet>' : ''}
      <app-page><app-card><button>Save</button></app-card></app-page>
    </app-root>`;
  root = document.querySelector('app-root')!;
  page = document.querySelector('app-page')!;
  card = document.querySelector('app-card')!;
  button = document.querySelector('button')!;

  const cardInstance = Object.assign(new AppCard(), {
    title: 'Revenue',
    size: signal('large'),
    tags: ['kpi', 3, { nested: true }],
    onPick: () => undefined,
    owner: { name: 'Ada', node: document.body },
    stream: { subscribe: () => undefined },
  });
  Object.defineProperty(cardInstance, 'broken', {
    get() {
      throw new Error('nope');
    },
  });
  instances = new Map<Element, object>([
    [root, new AppRoot()],
    [page, new AppPage()],
    [card, cardInstance],
  ]);
}

function hostOf(el: Element | null): Element | null {
  for (let node = el; node; node = node.parentElement) if (instances.has(node)) return node;
  return null;
}

function installIvy(): void {
  const hostByInstance = new Map([...instances].map(([host, cmp]) => [cmp, host]));
  Object.assign(window, {
    ng: {
      getComponent: (el: Element) => instances.get(el) ?? null,
      getOwningComponent: (el: Element) => {
        const host = hostOf(instances.has(el) ? el.parentElement : el);
        return host ? instances.get(host)! : null;
      },
      getHostElement: (cmp: object) => hostByInstance.get(cmp)!,
    },
  });
}

function installViewEngine(): void {
  const debugElements = new Map<Element, DebugElement>();
  const probe = (el: Element): DebugElement | null => {
    if (!el || el === document.body) return null;
    const cached = debugElements.get(el);
    if (cached) return cached;
    const owner = instances.has(el) ? el : hostOf(el.parentElement);
    const dbg: DebugElement = {
      name: el.localName,
      nativeElement: el,
      componentInstance: owner ? instances.get(owner) : undefined,
      properties: el === card ? { title: 'Revenue', onPick: () => undefined } : {},
      get parent() {
        return el.parentElement ? probe(el.parentElement) : null;
      },
    };
    debugElements.set(el, dbg);
    return dbg;
  };
  Object.assign(window, { ng: { probe } });
}

afterEach(() => {
  delete (window as { ng?: unknown }).ng;
  document.body.innerHTML = '';
});

describe('angularOwnerResolver on Ivy', () => {
  beforeEach(() => {
    buildDom(true);
    installIvy();
  });

  it('names the owning component, its chain up to the routed one, and its selector', () => {
    const owner = angularOwnerResolver(button);
    expect(owner).toMatchObject({
      framework: 'angular',
      component: 'AppCard',
      chain: ['AppPage'],
      hint: 'app-card',
    });
    expect(owner?.scope).toBe(card);
  });

  it('reads inputs, unwraps signals and drops what is not JSON safe', () => {
    expect(angularOwnerResolver(button)?.props).toEqual({
      title: 'Revenue',
      size: 'large',
      tags: ['kpi', 3],
      owner: { name: 'Ada' },
    });
  });

  it('treats a component host as its own component', () => {
    expect(angularOwnerResolver(card)?.component).toBe('AppCard');
  });

  it('walks up to the root when there is no router outlet', () => {
    buildDom(false);
    installIvy();
    expect(angularOwnerResolver(button)?.chain).toEqual(['AppPage', 'AppRoot']);
  });

  it('prefers the class name from debugInfo', () => {
    Object.assign(AppCard, {
      ɵcmp: { selectors: [['app-card']], debugInfo: { className: 'CardComponent' } },
    });
    try {
      expect(angularOwnerResolver(button)?.component).toBe('CardComponent');
    } finally {
      Object.assign(AppCard, { ɵcmp: { selectors: [['app-card']], inputs: {} } });
    }
  });

  it('returns null when getComponent throws', () => {
    Object.assign(window, {
      ng: {
        getOwningComponent: () => null,
        getComponent: () => {
          throw new Error('boom');
        },
      },
    });
    expect(angularOwnerResolver(button)).toBeNull();
  });

  it('returns null for a disconnected element', () => {
    expect(angularOwnerResolver(document.createElement('div'))).toBeNull();
  });
});

describe('angularOwnerResolver on View Engine', () => {
  beforeEach(() => {
    buildDom(true);
    installViewEngine();
  });

  it('finds the component, chain, hint, props and scope from DebugElements', () => {
    const owner = angularOwnerResolver(button);
    expect(owner).toMatchObject({
      framework: 'angular',
      component: 'AppCard',
      chain: ['AppPage'],
      hint: 'app-card',
      props: { title: 'Revenue' },
    });
    expect(owner?.scope).toBe(card);
  });

  it('walks up to the root when there is no router outlet', () => {
    buildDom(false);
    installViewEngine();
    expect(angularOwnerResolver(button)?.chain).toEqual(['AppPage', 'AppRoot']);
  });
});

describe('angularOwnerResolver without Angular', () => {
  it('returns null when window.ng is missing', () => {
    buildDom(true);
    expect(angularOwnerResolver(button)).toBeNull();
  });
});
