# Pointout

Click things in your running app, say what is wrong, hand Claude Code a brief it can act on.

## How it feels

1. Hit **Cmd+Shift+F**. Your app grows a crosshair.
2. Click the thing that bugs you.
3. Type what should change. **Enter**.
4. **Copy for Claude**, paste into Claude Code, sip something warm.

No screenshots with red circles. No "the button, you know, the blue one".

## Install

```sh
pnpm add -D @pointout/core @pointout/angular
```

## Angular in one line

In `app.config.ts`:

```ts
import { providePointout } from '@pointout/angular/providers';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), providePointout({ appName: 'My app' })],
};
```

Dev builds get Pointout. Production builds do not.
Older Angular, or no Angular at all? The package READMEs have you covered.

## The shortcut

**Cmd+Shift+F** on macOS, **Ctrl+Shift+F** everywhere else.
Or click the pill in the bottom right corner.

## What Claude gets

Straight from the demo app, trimmed:

````text
Pointout on Pointout demo — 2026-10-23T06:08:28.001Z
5 items, viewport 1280×813, dark

1. [DashboardCard (src/app/dashboard/dashboard-card.ts) › .value] on / — "12"
   Make the number bigger
2. [Dashboard (src/app/dashboard/dashboard.ts) › .failed] on / — "failed"
   Failed should be a red pill, not just red text
4. [ReleaseNotes (src/app/dashboard/release-notes.ts) › button] on / — "Mark as read"
   Copy feels smug, tone it down
5. [Settings (src/app/settings/settings.ts) › [data-testid="theme-toggle"]] on /settings — "Switch to light"
   Use a real switch here

Resolve each item in the component named; the selector is relative to that component. Ask before changing anything outside those components.

```json
{ "appName": "Pointout demo", "comments": [ ... ] }
```
````

Component, source file, selector, route, your words.
The JSON adds inputs, parent chain, bounding box and a DOM fallback owner.

## Packages

| Package                                   | What it does                                                 |
| ----------------------------------------- | ------------------------------------------------------------ |
| [`@pointout/core`](packages/core)         | The whole UI. Plain web component, zero deps, any framework. |
| [`@pointout/angular`](packages/angular)   | Names the Angular component behind every click. Angular 2+.  |
| `@pointout/react`, `@pointout/vue`, yours | React and Vue adapters welcome.                              |

## Write an adapter

It is one function and about 30 lines. [docs/adapters.md](docs/adapters.md) walks you through it.

## Develop

```sh
git clone https://github.com/pointout/pointout.git
cd pointout
corepack enable
pnpm install
pnpm build
pnpm test
pnpm --filter demo-angular start
```

Then open http://localhost:4200 and start pointing.

## Release

See [CONTRIBUTING.md](CONTRIBUTING.md). Changesets do the boring part.

## Credits

Built with Claude Code.

MIT licensed.
