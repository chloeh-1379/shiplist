# Developer notes

[Product overview](../README.md) · [简体中文使用说明](../README.zh-CN.md) · [API and data reference](../AGENTS.md)

ShipList uses plain Node.js 18+ and a single HTML frontend. No dependency installation, build step, or CDN is required.

## Launch options

```bash
node server.js --port 8080
node server.js --data ~/my-ideas
SHIPLIST_DATA=~/my-ideas node server.js
```

The data directory resolves in this order:

1. `--data <dir>`
2. `SHIPLIST_DATA`
3. `~/.config/shiplist/config.json` → `dataDir`
4. `~/ShipList`

The store is `<dataDir>/ideas.json`. `GET /api/health` reports the active directory. Changing workspaces in Settings saves the new configuration; if the destination has no `ideas.json`, the current store is copied there. An existing destination store is opened without merging it with the current one.

## Integrations

The local REST API supports reading, creating, updating, and deleting ideas, adding progress logs, and exporting JSON or Markdown. Send `X-Agent` to attribute writes. See [AGENTS.md](../AGENTS.md) for the complete routes, schema, and direct-file editing conventions.

The repository includes an optional [ShipList skill](../skills/shiplist/SKILL.md). Install it using your assistant’s supported skill workflow; the app itself does not require an AI assistant.

## Repository layout

- `server.js`: local HTTP server, storage, REST API, exports.
- `public/index.html`: frontend, styles, offline Markdown rendering, interactions.
- `start.command`: macOS launcher.
- `AGENTS.md`: API and storage conventions for agents.
- `skills/shiplist/`: optional idea-capture skill.
- `docs/demo/ideas.json`: five fictional projects for documentation screenshots.
- `docs/images/shiplist-overview.jpg`: actual homepage screenshot used by both READMEs.

## Documentation screenshot

To open the fictional sample workspace separately from your personal ideas:

```bash
node server.js --port 4521 --data ./docs/demo
```

Open `http://127.0.0.1:4521`. The README image was captured from the actual homepage at a desktop viewport of 1440 × 1000, using a full-page screenshot. It contains no personal data or AI-generated interface elements.

Writes in this demo workspace modify the tracked fixture. Use a copy of `docs/demo` in a temporary directory for interactive testing.

## README language links

The two READMEs use explicit GitHub URLs for language switching so previewers that cannot navigate between local Markdown files still have a web destination. Local files remain `README.md` and `README.zh-CN.md`; opening another document inside a preview pane depends on the previewer.
