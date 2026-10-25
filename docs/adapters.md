# Write an adapter

An adapter teaches Pointout one trick: which component owns this element.
That is it. One function. About 30 lines, give or take a type.

## What the core already does

You get all of this for free, with no adapter at all:

- The pill, the shortcut, hover outlines, the comment popover, badges.
- Hit testing through open shadow roots, plus intercept and alt-click modes.
- Selectors that prefer `#id`, then `[data-testid]`, then stable classes.
- `domOwner` on every comment: nearest `data-component`, `data-testid`, custom element,
  framework host attribute or labelled landmark, plus the closest heading.
- Storage per `appName`, reload survival, route aware badges.
- The brief, the JSON, Copy for Claude, Download .json.

So a page with zero framework support still gets a decent brief.
Your adapter only adds the framework's view of the world.

## The contract

```ts
type OwnerResolver = (el: Element) => OwnerInfo | null;

interface OwnerInfo {
  framework: string; // 'react', 'vue', 'svelte'...
  component: string; // the name a human would grep for
  chain: string[]; // parents, nearest first
  hint?: string; // tag or selector, if the framework has one
  props?: Record<string, unknown>; // keep it JSON safe and small
  file?: string; // source file, when the framework knows it
  scope?: Element; // component root; selectors become relative to it
}
```

Three rules.

1. **Never throw.** The core catches you anyway, logs once and moves on. Do not make it.
2. **Return `null` when unsure.** A wrong name is worse than none.
   The core falls back to `domOwner`.
3. **`scope` and `file` are optional.** Set `scope` only if it really contains `el`.
   The core ignores it otherwise.

`scope` never lands in storage or in the brief. It only shapes the selector.

## A sketch: React

Best effort, untested against every React version, clearly a sketch.
React dev builds hang a fiber on each DOM node under a `__reactFiber$<random>` key.
Walk up the fiber tree, keep the function components, done.

```ts
import { mountPointout, type OwnerResolver } from '@point-out/core';

interface Fiber {
  type: unknown;
  return: Fiber | null;
  child: Fiber | null;
  stateNode: unknown;
  memoizedProps?: Record<string, unknown>;
  _debugSource?: { fileName?: string }; // React 18 and older, dev only
}

const fiberOf = (el: Element): Fiber | null => {
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
  return key ? ((el as unknown as Record<string, Fiber>)[key] ?? null) : null;
};

const nameOf = (fiber: Fiber): string => {
  const type = fiber.type as { displayName?: string; name?: string };
  return type.displayName || type.name || 'Anonymous';
};

const firstElement = (fiber: Fiber): Element | undefined => {
  for (let f: Fiber | null = fiber; f; f = f.child) {
    if (f.stateNode instanceof Element) return f.stateNode;
  }
};

const primitives = (props: Record<string, unknown> = {}) =>
  Object.fromEntries(
    Object.entries(props).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)),
  );

export const reactOwnerResolver: OwnerResolver = (el) => {
  try {
    const owners: Fiber[] = [];
    for (let f = fiberOf(el); f; f = f.return) if (typeof f.type === 'function') owners.push(f);
    const [own, ...parents] = owners;
    if (!own) return null;
    return {
      framework: 'react',
      component: nameOf(own),
      chain: parents.map(nameOf),
      props: primitives(own.memoizedProps),
      file: own._debugSource?.fileName,
      scope: firstElement(own),
    };
  } catch {
    return null;
  }
};

mountPointout({ appName: 'My app', resolveOwner: reactOwnerResolver });
```

Things a real `@point-out/react` would care about: `memo` and `forwardRef` wrappers,
components that render fragments, and a `resolveUrl` for your router.

## Wire it up

```ts
import { mountPointout } from '@point-out/core';

mountPointout({ appName: 'My app', resolveOwner: myResolver });
```

Mount it in dev only. The core README shows how.

## Test it

Fake the framework globals or internals over a small jsdom tree, then assert the `OwnerInfo`.
[`resolver.spec.ts`](../packages/angular/src/resolver.spec.ts) in the Angular adapter does exactly that.
Add one test that throws inside your lookup and expects `null`.

## Ship it

Copy `packages/angular` as a starting point.
tsup, Vitest, `sideEffects: false`, `@point-out/core` as a peer.
Open a PR. We will be happy to see it.
