# 🚢 ShipList

English | [简体中文](./README.zh-CN.md)

A **local-first, offline** idea tracker for makers. Capture every idea, then track it
through its lifecycle until it **ships** — as a GitHub repo, an app, a web service,
a CLI, or something you sell.

- **Zero dependencies** — plain Node.js (18+), no `npm install`, works fully offline
- **Light, fast UI** — card board, status filters, full-text search, full-window
  detail view with built-in Markdown rendering (read mode by default, edit on demand)
- **Your data, your folder** — ideas live in a workspace directory *you* choose,
  completely separate from this code repo
- **Agent-friendly by design** — plain JSON storage, a REST API, and `AGENTS.md`
  conventions so AI coding agents can read, add, and update ideas autonomously
- **One-click export** — Markdown digest or full JSON, perfect for sharing or
  feeding to an agent

## Quick start

```bash
git clone https://github.com/chloeh-1379/shiplist.git
cd shiplist
node server.js          # → http://127.0.0.1:4520
```

That's it — no install step. On macOS you can also double-click `start.command`.

Options:

```bash
node server.js --port 8080              # custom port
node server.js --data ~/my-ideas        # custom data directory
SHIPLIST_DATA=~/my-ideas node server.js # same, via env var
```

## Where your data lives

Ideas are **never stored inside this repo**. The data directory ("workspace")
resolves in this order:

1. `--data <dir>` CLI flag
2. `SHIPLIST_DATA` environment variable
3. saved config `~/.config/shiplist/config.json` (settable from the UI ⚙️ Settings)
4. default: `~/ShipList/ideas.json`

The store is a single human-readable `ideas.json` — back it up, git-track it,
sync it, edit it by hand. Switching workspaces from the UI copies your existing
ideas over if the new folder is empty.

## Idea lifecycle

```
idea → planned → building → shipped / released / sold
                     ↘ parked (on hold)   ↘ stopped (killed)
```

Each idea has: title, summary, Markdown description, status, ship target
(github / app / web / cli / library / other), tags, priority, links, and an
attributed activity log.

## Using it with AI agents

ShipList is built to be read *and written* by agents:

- **API** (default port `4520`): `GET/POST /api/ideas`, `PATCH /api/ideas/:id`,
  `POST /api/ideas/:id/log`, `GET /api/export.md` — send an `X-Agent` header so
  writes are attributed in the log.
- **Data file**: when the server is down, agents can edit the workspace
  `ideas.json` directly.
- **Conventions**: see [AGENTS.md](./AGENTS.md) — schema, rules, and examples.
- **Agent Skill**: a ready-made `shiplist` skill (for Codex/Cursor-style agents)
  teaches agents to capture ideas from your conversations automatically:
  [skills/shiplist/SKILL.md](./skills/shiplist/SKILL.md). Copy it into your
  agent's skills directory (e.g. `~/.agents/skills/` or `~/.cursor/skills/`).

```bash
# example: agent adds an idea
curl -s -X POST http://127.0.0.1:4520/api/ideas \
  -H 'Content-Type: application/json' -H 'X-Agent: my-agent' \
  -d '{"title":"Pomodoro CLI","summary":"tiny focus timer","shipTarget":"cli"}'
```

## Export

- UI: header buttons `⬇︎ Markdown` / `⬇︎ JSON`
- CLI: `curl http://127.0.0.1:4520/api/export.md > ideas.md`

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus search |
| `Esc` | Close dialog / exit edit mode |
| `⌘/Ctrl + Enter` | Save while editing |

## Project layout

```
shiplist/
├── server.js            # zero-dep Node server: REST API + static hosting
├── public/index.html    # single-file UI (no build step, no CDN)
├── start.command        # double-clickable macOS launcher
├── AGENTS.md            # conventions for AI agents
├── skills/shiplist/     # Agent Skill for capturing ideas from chats
└── (your data lives elsewhere — see "Where your data lives")
```

## License

MIT
