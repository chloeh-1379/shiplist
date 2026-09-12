# AGENTS.md — How agents should use ShipList

ShipList is a **local, offline** idea tracker. Every idea is expected to eventually
**ship** — as a GitHub repo, an app, a web service, a CLI, etc.

You can interact with it in two ways. Prefer the **API** when the server is running;
fall back to **editing the data file directly** when it is not.

---

## 1. Data file (always available, offline)

The data file is **decoupled from the app code**. Its location (the "workspace")
resolves in this order:

1. `--data <dir>` CLI flag passed to `server.js`
2. `SHIPLIST_DATA` environment variable
3. saved config: `~/.config/shiplist/config.json` → `{ "dataDir": "..." }`
4. default: `~/ShipList/ideas.json`

The store file is always `<dataDir>/ideas.json`. To find the active location:
`GET /api/health` returns `dataDir` when the server runs; otherwise read the
config file (missing → default `~/ShipList/ideas.json`).

Plain JSON, human-readable:

```json
{
  "version": 1,
  "ideas": [
    {
      "id": "uuid",
      "title": "short name",
      "summary": "one-paragraph pitch",
      "description": "markdown: context, MVP scope, tech choices, next steps",
      "status": "idea | planned | building | shipped | released | parked | stopped | sold",
      "shipTarget": "github | app | web | cli | library | other",
      "tags": ["ai", "ios"],
      "links": [{ "label": "repo", "url": "https://github.com/..." }],
      "priority": 0,
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "shippedAt": null,
      "log": [{ "at": "ISO-8601", "text": "what happened", "by": "agent-name" }]
    }
  ]
}
```

Rules when editing the file directly:

- Generate `id` as a UUID v4; never reuse ids.
- Always update `updatedAt`; set `shippedAt` when status first becomes `shipped`/`released`/`sold`.
- Append to `log` (newest first) with your agent name in `by`, e.g. `"by": "deepseek-harness"`.
- Keep the file valid JSON with 2-space indent.

## 2. HTTP API (when `node server.js` is running, default port 4520)

Base URL: `http://127.0.0.1:4520` — set header `X-Agent: <your-name>` so your writes are attributed.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness check (returns active `dataDir`) |
| GET | `/api/config` | current workspace config |
| POST | `/api/config` | switch workspace `{ "dataDir": "~/my-ideas" }` |
| GET | `/api/ideas?status=idea&tag=ai&q=foo` | list / filter / search |
| POST | `/api/ideas` | create idea (body = idea fields) |
| GET | `/api/ideas/:id` | read one idea |
| PATCH | `/api/ideas/:id` | partial update |
| DELETE | `/api/ideas/:id` | delete |
| POST | `/api/ideas/:id/log` | append log entry `{ "text": "..." }` |
| GET | `/api/export.json` | full JSON export |
| GET | `/api/export.md` | markdown digest of all ideas |

### Examples

```bash
# quick scan of everything
curl -s http://127.0.0.1:4520/api/ideas

# add a new idea
curl -s -X POST http://127.0.0.1:4520/api/ideas \
  -H 'Content-Type: application/json' -H 'X-Agent: my-agent' \
  -d '{"title":"Pomodoro CLI","summary":"tiny focus timer","shipTarget":"cli","tags":["go","focus"]}'

# log progress / mark as shipped
curl -s -X POST http://127.0.0.1:4520/api/ideas/<id>/log \
  -H 'Content-Type: application/json' -H 'X-Agent: my-agent' \
  -d '{"text":"MVP done, repo pushed"}'
curl -s -X PATCH http://127.0.0.1:4520/api/ideas/<id> \
  -H 'Content-Type: application/json' -H 'X-Agent: my-agent' \
  -d '{"status":"shipped","links":[{"label":"repo","url":"https://github.com/me/pomodoro-cli"}]}'
```

## 3. Conventions

- An idea is **not done** until `status` is `shipped` (code released), `released`
  (published to users: App Store / GitHub release / deployed), or `sold`
  (project sold to someone else). `stopped` means deliberately killed — record
  why in the log so the next agent knows.
- When you ship something, add the repo/store link to `links` and a log entry
  saying where it shipped.
- Write `description` in Markdown so the next agent can pick the idea up cold:
  context → MVP scope → tech stack → open questions → next step.
