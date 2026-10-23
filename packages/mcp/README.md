# @pointout/mcp

Claude Code reads your Pointout comments straight from the running app.
It replies, fixes, resolves, and the badges turn green while you watch.

## Setup

Register it once for every project:

```sh
claude mcp add --scope user pointout -- npx -y @pointout/mcp
```

Or for one project, in `.mcp.json`:

```json
{
  "mcpServers": {
    "pointout": { "command": "npx", "args": ["-y", "@pointout/mcp"] }
  }
}
```

Then tell the app to sync:

```ts
mountPointout({ appName: 'My app', server: true });
```

## How sessions work

Every Claude Code chat starts its own `pointout-mcp` and registers a session, like `shop #1`.
The first one grabs `127.0.0.1:7331` and becomes the hub. The rest talk to it.
If the hub chat ends, the next tool call anywhere takes the port over. Nothing is lost.
The browser picks the only live session, or lets you choose when there are several.

## Tools

| Tool               | Input                                            | Does                                          |
| ------------------ | ------------------------------------------------ | --------------------------------------------- |
| `pointout_session` | `{ name? }`                                      | This session, the hub, live sessions, counts  |
| `pointout_list`    | `{ status?: open \| resolved \| all, session? }` | Compact JSON, open comments by default        |
| `pointout_brief`   | `{ session? }`                                   | Exactly what Copy for Claude would paste      |
| `pointout_reply`   | `{ id, text }`                                   | Adds a reply the browser shows in the thread  |
| `pointout_resolve` | `{ ids, note? }`                                 | Marks them resolved, the note becomes a reply |
| `pointout_reopen`  | `{ id }`                                         | Marks it open again                           |

`session` takes an id or a name and defaults to this chat.

## The `triage` prompt

Run `/mcp__pointout__triage` in Claude Code. It says:

> Call pointout_brief. Fix each open item inside the component named, using the file path when given.
> After each fix call pointout_reply with one line on what changed, then pointout_resolve.
> Ask before touching anything outside those components.

## Run the hub alone

```sh
npx @pointout/mcp serve
```

Handy when no Claude chat is open yet, or when you want its logs in a terminal.

## Environment

| Variable           | Default         | What it does                                 |
| ------------------ | --------------- | -------------------------------------------- |
| `POINTOUT_PORT`    | `7331`          | Hub port. Change the app's `server` URL too. |
| `POINTOUT_HOME`    | `~/.pointout`   | Where session files live                     |
| `POINTOUT_PROJECT` | name of the cwd | Folder for this chat's sessions              |
| `POINTOUT_LOG`     | `info`          | `debug`, `info` or `silent`. Always stderr.  |

## Debug it with curl

Everything Claude does goes through the same HTTP routes, so you can poke at them.

```sh
curl localhost:7331/                        # every route, the store path, the pid
curl localhost:7331/health                  # who holds the port
curl localhost:7331/sessions                # live sessions
curl 'localhost:7331/state?app=My%20app'    # what the browser sees
ls ~/.pointout/*/                           # one JSON file per session
```

Comments without a session wait in `_unassigned.json` until one shows up.
Screenshots stay in the files. The brief never carries them.

## Local only

Local dev data, no auth, `127.0.0.1` only. Only `localhost` pages get CORS.
