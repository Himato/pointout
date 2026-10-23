# @pointout/angular

Pointout, but it knows your components.
Every element you click comes back with its component, parent chain, selector and inputs.

Works from Angular 2 to 22. No decorators, no compiler, no markup changes.

## Install

```sh
pnpm add -D @pointout/core @pointout/angular
```

## Setup for modern apps (15+)

In `app.config.ts`:

```ts
import { providePointout } from '@pointout/angular/providers';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), providePointout({ appName: 'My app' })],
};
```

Dev builds get Pointout. Production builds get nothing, not even an unused lazy chunk.
If you use the router, comment URLs come from `router.url`.
A `resolveUrl` you pass wins over it.

## Setup for any Angular version

In `main.ts`, after you bootstrap:

```ts
declare const ngDevMode: boolean | undefined;

if (typeof ngDevMode === 'undefined' || ngDevMode) {
  import('@pointout/angular').then(({ mountPointoutForAngular }) =>
    mountPointoutForAngular({ appName: 'My app' }),
  );
}
```

Pre Ivy apps (Angular 8 and older) do not have `ngDevMode`. Use your environment flag:

```ts
if (!environment.production) {
  import('@pointout/angular').then(({ mountPointoutForAngular }) =>
    mountPointoutForAngular({ appName: 'My app' }),
  );
}
```

Honest note: that form still ships an unused lazy chunk in prod. It never loads, it just sits there.

`appName` defaults to `document.title`. Every other `@pointout/core` option works too.

## Use it

Press **Cmd+Shift+F** on macOS or **Ctrl+Shift+F** elsewhere.
Click things. Type what is wrong. Hit **Copy for Claude**. Paste into Claude Code.

## Talk to Claude directly

Add `server: true` and Claude Code reads your comments without the copy and paste:

```ts
providePointout({ appName: 'My app', server: true });
```

The two setup commands live in the [root README](../../README.md#talk-to-claude-directly).

## What gets resolved

| Angular                    | Source                  | You get                                                 |
| -------------------------- | ----------------------- | ------------------------------------------------------- |
| Ivy, 9+                    | `ng.getOwningComponent` | component, chain up to the routed one, selector, inputs |
| Ivy, 17.1+ dev builds      | `ɵcmp.debugInfo`        | real class name and source file path                    |
| View Engine, 2 to 8        | `ng.probe` DebugElement | component, chain, tag name, bound properties            |
| None (prod build, no `ng`) | nothing                 | `null`, so the core falls back to its DOM owner         |

Signal inputs are unwrapped. Functions, observables, DOM nodes and anything that throws are left out.
The resolver never throws. When it is not sure, it says `null`.
The core still writes a decent brief.

## Staging

Want it on a staging build where `ngDevMode` is false?

```ts
import { providePointoutAlways } from '@pointout/angular/always';

export const appConfig: ApplicationConfig = {
  providers: [providePointoutAlways({ appName: 'My app (staging)' })],
};
```

It has its own import on purpose.
Bundlers emit a chunk for every `import()` they see in a file.
Sharing a file with `providePointout` would ship Pointout to prod.

Your call. Just keep it away from real users.

## Your markup

Nothing needs to change.
`id` and `data-testid` make selectors nicer, and you probably have those already.

## Bring your own setup

The resolver is exported on its own if you mount the core yourself:

```ts
import { mountPointout } from '@pointout/core';
import { angularOwnerResolver } from '@pointout/angular';

mountPointout({ appName: 'My app', resolveOwner: angularOwnerResolver });
```

## License

MIT
