---
name: shiplist
description: Capture ideas discussed in conversation into the user's local ShipList idea tracker. Use when the conversation surfaces a new app/tool/product/project idea the user may want to build or ship (e.g. "I have an idea", "我有个想法", "side project", "做个工具", "app idea", "ship it"), when the user asks to save/record/add an idea, or when an existing tracked idea is being updated or shipped.
---

# ShipList — capture ideas into the user's local idea tracker

The user keeps a **local, offline** idea tracker called **ShipList**. Every entry
is an idea expected to eventually ship (GitHub repo, app, web service, CLI…).

- App: a local clone of the ShipList repo (`server.js` at its root). If you don't
  know where it is, find it: `mdfind -name shiplist 2>/dev/null | head` on macOS,
  or ask the user once and remember.
- Data file: **decoupled from the app** — lives in a user-chosen workspace.
  Resolve it via `GET /api/health` (returns `dataDir`); when the server is down,
  read `~/.config/shiplist/config.json` → `dataDir`, falling back to
  `~/ShipList/ideas.json`. The store is always `<dataDir>/ideas.json`.
- API: `http://127.0.0.1:4520` (only when `node server.js` is running)
- Full data schema & conventions: read `AGENTS.md` at the repo root if unsure

## When to act

**Proactively suggest (once per idea).** When the conversation produces an idea
with real substance — what it does, who it's for, maybe how it could work — and
it isn't in ShipList yet, offer briefly in the user's language:

> "这个想法挺完整的——要我用 shiplist skill 把它记到你的 ShipList 吗？"

Don't ask for one-line jokes or pure hypotheticals; don't ask twice for the same
idea. If the user says yes (or explicitly asks to save/记下/加到 ship list at any
point), capture it immediately. Also act without asking when the user updates or
ships an existing tracked idea.

## How to capture

**Step 1 — check the API:**

```bash
curl -s --max-time 1 http://127.0.0.1:4520/api/health
```

**Step 2 — dedupe:** search existing ideas before creating:

```bash
curl -sG http://127.0.0.1:4520/api/ideas --data-urlencode "q=<keyword>"
```

If a match exists → update it (PATCH) and/or append a log entry instead of
creating a duplicate.

**Step 3 — write via API** (set `X-Agent` to your own name for attribution):

```bash
curl -s -X POST http://127.0.0.1:4520/api/ideas \
  -H 'Content-Type: application/json' -H 'X-Agent: <your-agent-name>' \
  -d '{
    "title": "...",
    "summary": "...",
    "description": "## Context\n...\n\n## MVP scope\n...\n\n## Tech stack\n...\n\n## Next steps\n...",
    "shipTarget": "github | app | web | cli | library | other",
    "tags": ["..."],
    "priority": 0
  }'
```

Update / log on an existing idea:

```bash
curl -s -X PATCH http://127.0.0.1:4520/api/ideas/<id> \
  -H 'Content-Type: application/json' -H 'X-Agent: <your-agent-name>' \
  -d '{"status": "building"}'
curl -s -X POST http://127.0.0.1:4520/api/ideas/<id>/log \
  -H 'Content-Type: application/json' -H 'X-Agent: <your-agent-name>' \
  -d '{"text": "MVP scope agreed in discussion: …"}'
```

**Fallback — server not running:** edit the workspace's `ideas.json` directly
(resolve its path as described above) following the rules in the repo's
`AGENTS.md` (UUID v4 id, ISO-8601 timestamps, update `updatedAt`, append to
`log` newest-first with `"by": "<your-agent-name>"`, keep valid 2-space-indented
JSON).

## What to write

Extract from the conversation, don't invent:

- `title`: ≤ 10 words, in the user's language.
- `summary`: 1–2 sentences — problem + for whom.
- `description`: Markdown the next agent can pick up cold — Context / MVP scope /
  Tech stack / Open questions / Next steps. Include decisions made during this
  conversation.
- `shipTarget`: infer from discussion (mobile → `app`, OSS repo → `github`,
  terminal tool → `cli`); default `other`.
- `tags`: 2–5 lowercase keywords.
- Statuses available: `idea`, `planned`, `building`, `shipped`, `released`,
  `parked`, `stopped`, `sold`.

## After writing

Reply briefly in the user's language: what was recorded (title), where
(ShipList), and that it's viewable at `http://127.0.0.1:4520` (start it with
`node server.js` in the repo, or the user's `shiplist` shell command).
Don't dump the whole JSON back.
