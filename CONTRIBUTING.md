# Contributing

Thanks for showing up. Here is all you need.

## Setup

```sh
corepack enable
pnpm install
```

Node 22. pnpm is pinned in `package.json`, corepack picks it up.

## Scripts

| Script              | Does                                      |
| ------------------- | ----------------------------------------- |
| `pnpm build`        | Builds every package                      |
| `pnpm test`         | Runs every test                           |
| `pnpm typecheck`    | `tsc` over every package                  |
| `pnpm lint`         | ESLint                                    |
| `pnpm format`       | Prettier writes                           |
| `pnpm format:check` | Prettier checks                           |
| `pnpm check:bundle` | Proves Pointout stays out of prod bundles |

Fresh clone? Run `pnpm build` before `lint` or `typecheck`. The adapters and the MCP read core's built types.

A pre-commit hook runs Prettier and ESLint on staged files. You will barely notice it.

## Changesets

Changed a published package? Add a changeset.

```sh
pnpm changeset
```

Pick the packages, pick the bump, write one line for the changelog. Commit the file with your PR.

Docs, tests and the demo app do not need one.

## Releasing

Maintainers only.

```sh
pnpm changeset
pnpm run version
git add -A && git commit -m "chore: release"
git tag vX.Y.Z
git push && git push --tags
```

Yes, `run`. Plain `pnpm version` is a pnpm builtin and skips our script.

The tag triggers the publish workflow. Go get coffee.
