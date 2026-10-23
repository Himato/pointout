# @pointout/core

Click a thing in your running app. Say what is wrong with it.
Copy a brief that Claude Code can act on without guessing.

Plain web component. Zero runtime dependencies. Works with any framework, or none.

## Install

```sh
pnpm add -D @pointout/core
```

## Mount

Do it in dev only. Your users do not need this.

```ts
if (import.meta.env.DEV) {
  const { mountPointout } = await import('@pointout/core');
  mountPointout({ appName: 'My app' });
}
```

That adds one `<point-out>` element to `document.body`.
Everything else lives inside its shadow root, so your styles stay yours.

## Use it

1. Press **Cmd+Shift+F** on macOS or **Ctrl+Shift+F** elsewhere. Or click the pill in the bottom right.
2. Hover. Pointout outlines whatever is under the cursor and names it.
3. Click. Type what should change. **Enter** adds it, **Shift+Enter** is a new line, **Esc** bails.
4. Open the pill menu and hit **Copy for Claude**.
5. Paste into Claude Code. Go make tea.

Numbered badges mark what you already commented on.
They survive reloads and route changes, and fade out when their element is gone.

## Options

| Option         | Default              | What it does                                                                |
| -------------- | -------------------- | --------------------------------------------------------------------------- |
| `appName`      | required             | Shown in the brief. Also the storage key, `pointout:<appName>`.             |
| `resolveOwner` | none                 | Framework enricher. Names the component that owns an element.               |
| `resolveUrl`   | path + search + hash | Hook for your router.                                                       |
| `selectMode`   | `'intercept'`        | `'intercept'` eats the selecting click. `'alt-click'` only takes Alt+click. |
| `shortcut`     | `'Mod+Shift+F'`      | `Mod` is Cmd on macOS, Ctrl elsewhere. Also `Ctrl`, `Meta`, `Shift`, `Alt`. |
| `storage`      | `'session'`          | `'session'`, `'local'` or `'none'`.                                         |
| `screenshot`   | none                 | `(el) => Promise<dataUrl \| null>`. Bring your own capture.                 |
| `formatter`    | `defaultFormatter`   | `(bundle) => string`. Change how Copy for Claude reads.                     |

`mountPointout` returns a handle:

```ts
const pointout = mountPointout({ appName: 'My app' });

pointout.toggle(); // or toggle(true), toggle(false)
pointout.getComments();
pointout.exportText(); // what Copy for Claude copies
pointout.exportJson(); // what Download .json saves
pointout.clear();
pointout.unmount();
```

Mounting twice replaces the first one. On the server it does nothing, so SSR will not trip over it.

## What Claude gets

A short brief on top, the full JSON underneath:

````text
Pointout on My app — 2026-10-23T09:00:00.000Z
2 items, viewport 1440×900, dark

1. [AlertsTableComponent › #alerts-tbl] on /alerts — "SLA breach alerts"
   Header should stick on scroll
2. [<section "SLA breach alerts"> › tr:nth-of-type(3)] on /alerts — "INC-42 late by 3h"
   Wrong colour

Resolve each item in the component named; the selector is relative to that component. Ask before changing anything outside those components.

```json
{ "appName": "My app", "comments": [ ... ] }
```
````

Each comment carries two owners.

- `owner` comes from your framework adapter. It can be `null`.
- `domOwner` is always there. The core finds the nearest `data-component`, `data-testid`, custom element, framework host attribute or labelled landmark, plus the closest heading.

So a plain HTML page still gets a useful brief. An adapter just makes it sharper.

Selectors prefer `#id`, then `[data-testid]`, then tag, stable classes and `:nth-of-type`.
Generated junk like `ng-star-inserted` or `css-1x9fa2k` is skipped.

## Write an adapter

An adapter is one function: `(el) => OwnerInfo | null`.
Never throw, return `null` when unsure. The core guards you anyway.

See [docs/adapters.md](../../docs/adapters.md) for the whole thing in about 30 lines.
Angular already has one: [`@pointout/angular`](../angular).

## Hack on it

```sh
pnpm --filter @pointout/core build
pnpm --filter @pointout/core test
npx serve packages/core
```

Then open `/playground/` for a page to poke at.

## License

MIT
