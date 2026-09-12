#!/usr/bin/env node
/**
 * ShipList — local idea incubator.
 * Zero-dependency Node server: serves the UI and a JSON REST API.
 * Data lives in data/ideas.json so any agent can read/write it directly too.
 *
 * Usage:  node server.js [--port 3080]
 */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const LEGACY_DATA_FILE = path.join(ROOT, 'data', 'ideas.json'); // pre-workspace location
const CONFIG_DIR = path.join(os.homedir(), '.config', 'shiplist');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const DEFAULT_DATA_DIR = path.join(os.homedir(), 'ShipList');

const argPort = process.argv.indexOf('--port');
const PORT =
  (argPort > -1 && Number(process.argv[argPort + 1])) ||
  Number(process.env.PORT) ||
  4520;

// ---------- data directory (workspace) resolution ----------
// priority: --data <dir>  >  SHIPLIST_DATA env  >  saved config  >  ~/ShipList

function expandHome(p) {
  if (typeof p !== 'string' || !p) return null;
  const expanded = p === '~' ? os.homedir() : p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
  return path.resolve(expanded);
}

function loadSavedDataDir() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    return expandHome(cfg.dataDir);
  } catch {
    return null;
  }
}

function saveDataDir(dir) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ dataDir: dir }, null, 2));
}

function resolveInitialDataDir() {
  const argIdx = process.argv.indexOf('--data');
  return (
    (argIdx > -1 && expandHome(process.argv[argIdx + 1])) ||
    expandHome(process.env.SHIPLIST_DATA) ||
    loadSavedDataDir() ||
    DEFAULT_DATA_DIR
  );
}

let dataDir = resolveInitialDataDir();
const dataFile = () => path.join(dataDir, 'ideas.json');

const STATUSES = ['idea', 'planned', 'building', 'shipped', 'released', 'parked', 'stopped', 'sold'];
// statuses that mean the idea reached an end state worth stamping shippedAt
const TERMINAL_STATUSES = ['shipped', 'released', 'sold'];
const TARGETS = ['github', 'app', 'web', 'cli', 'library', 'other'];

// ---------- storage ----------

function migrateLegacyData() {
  // one-time move from <app>/data/ideas.json into the resolved workspace
  try {
    if (fs.existsSync(LEGACY_DATA_FILE) && !fs.existsSync(dataFile())) {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.copyFileSync(LEGACY_DATA_FILE, dataFile());
      console.log(`[shiplist] migrated legacy data → ${dataFile()}`);
    }
  } catch (err) {
    console.error(`[shiplist] legacy migration skipped: ${err.message}`);
  }
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile())) {
    fs.writeFileSync(dataFile(), JSON.stringify({ version: 1, ideas: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
    if (!Array.isArray(raw.ideas)) raw.ideas = [];
    return raw;
  } catch (err) {
    // keep a backup of a corrupted file instead of crashing
    const backup = dataFile() + '.corrupt-' + Date.now();
    fs.copyFileSync(dataFile(), backup);
    console.error(`[shiplist] data file corrupted, backed up to ${backup}`);
    return { version: 1, ideas: [] };
  }
}

function writeStore(store) {
  ensureStore();
  const tmp = dataFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, dataFile()); // atomic-ish replace
}

// ---------- model ----------

function now() {
  return new Date().toISOString();
}

function cleanString(v, max = 20000) {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function cleanLinks(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l) => l && typeof l === 'object' && (l.url || l.label))
    .slice(0, 20)
    .map((l) => ({ label: cleanString(l.label, 120), url: cleanString(l.url, 500) }));
}

function cleanTags(v) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim().slice(0, 40)))].slice(0, 20);
}

function applyIdeaFields(target, body, { partial = false } = {}) {
  const set = (key, val) => {
    if (partial && val === undefined) return;
    target[key] = val;
  };
  if (!partial || body.title !== undefined) set('title', cleanString(body.title, 200).trim());
  if (!partial || body.summary !== undefined) set('summary', cleanString(body.summary, 500));
  if (!partial || body.description !== undefined) set('description', cleanString(body.description, 50000));
  if (!partial || body.status !== undefined) {
    const s = STATUSES.includes(body.status) ? body.status : partial ? undefined : 'idea';
    if (s !== undefined) set('status', s);
  }
  if (!partial || body.shipTarget !== undefined) {
    const t = TARGETS.includes(body.shipTarget) ? body.shipTarget : partial ? undefined : 'other';
    if (t !== undefined) set('shipTarget', t);
  }
  if (!partial || body.tags !== undefined) set('tags', cleanTags(body.tags));
  if (!partial || body.links !== undefined) set('links', cleanLinks(body.links));
  if (!partial || body.priority !== undefined) {
    const p = Number(body.priority);
    set('priority', Number.isFinite(p) ? Math.max(0, Math.min(5, Math.round(p))) : 0);
  }
}

function createIdea(body, by) {
  const idea = {
    id: crypto.randomUUID(),
    title: '',
    summary: '',
    description: '',
    status: 'idea',
    shipTarget: 'other',
    tags: [],
    links: [],
    priority: 0,
    createdAt: now(),
    updatedAt: now(),
    shippedAt: null,
    log: [],
  };
  applyIdeaFields(idea, body);
  if (!idea.title) idea.title = 'Untitled idea';
  if (TERMINAL_STATUSES.includes(idea.status)) idea.shippedAt = now();
  if (Array.isArray(body.log)) {
    idea.log = body.log
      .filter((e) => e && typeof e === 'object' && e.text)
      .slice(0, 100)
      .map((e) => ({
        at: typeof e.at === 'string' ? e.at : now(),
        text: cleanString(e.text, 5000),
        by: cleanString(e.by, 80) || by || 'agent',
      }));
  }
  if (by) idea.log.unshift({ at: now(), text: 'Idea created', by });
  return idea;
}

// ---------- export ----------

function statusLabel(s) {
  return {
    idea: '💡 Idea',
    planned: '🗓️ Planned',
    building: '🚧 Building',
    shipped: '🚢 Shipped',
    released: '🎉 Released',
    parked: '🅿️ Parked',
    stopped: '🛑 Stopped',
    sold: '🤑 Sold',
  }[s] || s;
}

function toMarkdown(store) {
  const lines = [
    '# ShipList — Ideas Export',
    '',
    `Exported: ${now()} · ${store.ideas.length} idea(s)`,
    '',
    '> Machine-readable version: GET /api/ideas or read data/ideas.json',
    '',
  ];
  const order = ['building', 'planned', 'idea', 'shipped', 'released', 'sold', 'parked', 'stopped'];
  const sorted = [...store.ideas].sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.priority - a.priority
  );
  for (const idea of sorted) {
    lines.push(`## ${idea.title}`);
    lines.push('');
    lines.push(
      `- status: ${idea.status} · ship to: ${idea.shipTarget} · priority: ${idea.priority}`
    );
    if (idea.tags.length) lines.push(`- tags: ${idea.tags.join(', ')}`);
    lines.push(`- id: ${idea.id}`);
    lines.push(`- created: ${idea.createdAt} · updated: ${idea.updatedAt}`);
    if (idea.shippedAt) lines.push(`- shipped: ${idea.shippedAt}`);
    if (idea.summary) lines.push('', idea.summary);
    if (idea.description) lines.push('', idea.description);
    if (idea.links.length) {
      lines.push('', 'Links:');
      for (const l of idea.links) lines.push(`- [${l.label || l.url}](${l.url})`);
    }
    if (idea.log.length) {
      lines.push('', 'Log:');
      for (const e of idea.log) lines.push(`- ${e.at}${e.by ? ` (${e.by})` : ''}: ${e.text}`);
    }
    lines.push('', '---', '');
  }
  return lines.join('\n');
}

// ---------- http helpers ----------

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && body !== null && !Buffer.isBuffer(body);
  const payload = isObj ? JSON.stringify(body, null, 2) : body;
  res.writeHead(code, {
    'Content-Type': isObj ? 'application/json; charset=utf-8' : headers['Content-Type'] || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, { error: 'not found' });
    send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  });
}

// ---------- router ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    // API
    if (parts[0] === 'api') {
      if (parts[1] === 'health') {
        return send(res, 200, { ok: true, app: 'shiplist', time: now(), dataDir });
      }

      if (parts[1] === 'config') {
        if (req.method === 'GET') {
          return send(res, 200, {
            dataDir,
            dataFile: dataFile(),
            defaultDataDir: DEFAULT_DATA_DIR,
            configFile: CONFIG_FILE,
            ideaCount: readStore().ideas.length,
          });
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          const next = expandHome(body.dataDir);
          if (!next) return send(res, 400, { error: 'dataDir is required (absolute path or ~/…)' });
          fs.mkdirSync(next, { recursive: true });
          const nextFile = path.join(next, 'ideas.json');
          // carry the current store over if the new workspace is empty
          let migrated = false;
          if (!fs.existsSync(nextFile) && fs.existsSync(dataFile())) {
            fs.copyFileSync(dataFile(), nextFile);
            migrated = true;
          }
          dataDir = next;
          saveDataDir(next);
          ensureStore();
          console.log(`[shiplist] workspace switched → ${next}${migrated ? ' (existing ideas copied)' : ''}`);
          return send(res, 200, {
            dataDir,
            dataFile: dataFile(),
            migrated,
            ideaCount: readStore().ideas.length,
          });
        }
      }

      if (parts[1] === 'export.md') {
        return send(res, 200, toMarkdown(readStore()), {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': 'attachment; filename="shiplist-ideas.md"',
        });
      }

      if (parts[1] === 'export.json') {
        return send(res, 200, readStore(), {
          'Content-Disposition': 'attachment; filename="shiplist-ideas.json"',
        });
      }

      if (parts[1] === 'ideas') {
        const store = readStore();

        // collection
        if (parts.length === 2) {
          if (req.method === 'GET') {
            const { status, tag, q } = Object.fromEntries(url.searchParams);
            let ideas = store.ideas;
            if (status) ideas = ideas.filter((i) => i.status === status);
            if (tag) ideas = ideas.filter((i) => i.tags.includes(tag));
            if (q) {
              const needle = q.toLowerCase();
              ideas = ideas.filter((i) =>
                [i.title, i.summary, i.description].join('\n').toLowerCase().includes(needle)
              );
            }
            return send(res, 200, { ideas, count: ideas.length });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const by = cleanString(req.headers['x-agent'] || body.by, 80) || null;
            const idea = createIdea(body, by);
            store.ideas.unshift(idea);
            writeStore(store);
            return send(res, 201, idea);
          }
        }

        // single idea
        const id = parts[2];
        const idea = store.ideas.find((i) => i.id === id);
        if (!idea) return send(res, 404, { error: 'idea not found' });

        if (parts.length === 3) {
          if (req.method === 'GET') return send(res, 200, idea);
          if (req.method === 'PATCH' || req.method === 'PUT') {
            const body = await readBody(req);
            const prevStatus = idea.status;
            applyIdeaFields(idea, body, { partial: req.method === 'PATCH' });
            if (TERMINAL_STATUSES.includes(idea.status) && !TERMINAL_STATUSES.includes(prevStatus)) {
              idea.shippedAt = now();
            }
            if (!TERMINAL_STATUSES.includes(idea.status)) idea.shippedAt = null;
            idea.updatedAt = now();
            const by = cleanString(req.headers['x-agent'] || body.by, 80);
            if (by) idea.log.unshift({ at: now(), text: 'Idea updated', by });
            writeStore(store);
            return send(res, 200, idea);
          }
          if (req.method === 'DELETE') {
            store.ideas = store.ideas.filter((i) => i.id !== id);
            writeStore(store);
            return send(res, 200, { deleted: id });
          }
        }

        // append log entry
        if (parts[3] === 'log' && req.method === 'POST') {
          const body = await readBody(req);
          if (!body.text) return send(res, 400, { error: 'text is required' });
          const entry = {
            at: now(),
            text: cleanString(body.text, 5000),
            by: cleanString(req.headers['x-agent'] || body.by, 80) || 'agent',
          };
          idea.log.unshift(entry);
          idea.updatedAt = now();
          writeStore(store);
          return send(res, 201, entry);
        }
      }

      return send(res, 404, { error: 'unknown api route' });
    }

    // static
    if (req.method === 'GET') {
      const rel = parts.length ? parts.join('/') : 'index.html';
      const filePath = path.join(PUBLIC_DIR, rel);
      if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
      return serveStatic(res, filePath);
    }

    send(res, 405, { error: 'method not allowed' });
  } catch (err) {
    send(res, err.message === 'invalid JSON body' || err.message === 'payload too large' ? 400 : 500, {
      error: err.message,
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  migrateLegacyData();
  ensureStore();
  console.log(`\n  🚢 ShipList running at  http://127.0.0.1:${PORT}\n`);
  console.log(`  workspace: ${dataDir}`);
  console.log(`  data:      ${dataFile()}`);
  console.log(`  api:       GET/POST /api/ideas · GET /api/export.md · GET/POST /api/config\n`);
});
