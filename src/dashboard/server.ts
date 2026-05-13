import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { getDashboardDb, closeDashboardDb } from './db.js';
import 'dotenv/config';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3847;

// Content stats cache (dev.to API — 30min TTL)
let contentStatsCache: null | {
  articles: Array<{ id: number; title: string; url: string; publishedAt: string | null; views: number; reactions: number; comments: number; tags: string[] }>;
  totals: { count: number; views: number; reactions: number };
  fetchedAt: string;
} = null;
let contentStatsCacheTime = 0;

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

function notFound(res: http.ServerResponse): void {
  json(res, { error: 'Not found' }, 404);
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  // Serve static HTML
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const db = getDashboardDb();

  // GET /api/dashboard
  if (method === 'GET' && url === '/api/dashboard') {
    const actions = db.prepare("SELECT * FROM action_items ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, id ASC").all();
    const activity = db.prepare('SELECT * FROM team_activity ORDER BY created_at DESC').all();
    const skills = db.prepare('SELECT * FROM skill_registry ORDER BY id ASC').all();
    const growth = db.prepare('SELECT * FROM growth_log ORDER BY created_at DESC LIMIT 20').all();
    const decisions = db.prepare('SELECT * FROM decisions ORDER BY created_at DESC').all();
    const unseenActions = (db.prepare('SELECT COUNT(*) as c FROM action_items WHERE seen_by_ceo = 0').get() as { c: number }).c;
    const unseenActivity = (db.prepare('SELECT COUNT(*) as c FROM team_activity WHERE seen_by_ceo = 0').get() as { c: number }).c;
    const unseenGrowth = (db.prepare('SELECT COUNT(*) as c FROM growth_log WHERE seen_by_ceo = 0').get() as { c: number }).c;
    const unseenDecisions = (db.prepare('SELECT COUNT(*) as c FROM decisions WHERE seen_by_ceo = 0').get() as { c: number }).c;
    const pendingCeoTodos = (db.prepare("SELECT COUNT(*) as c FROM ceo_todos WHERE status = 'todo'").get() as { c: number }).c;

    json(res, {
      actions,
      activity,
      skills,
      growth,
      decisions,
      summary: { unseenActions, unseenActivity, unseenGrowth, unseenDecisions, pendingCeoTodos },
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  // GET /api/actions
  if (method === 'GET' && url === '/api/actions') {
    const rows = db.prepare("SELECT * FROM action_items ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, id ASC").all();
    json(res, rows);
    return;
  }

  // POST /api/actions/:id/seen
  const actionSeenMatch = url.match(/^\/api\/actions\/(\d+)\/seen$/);
  if (method === 'POST' && actionSeenMatch) {
    const id = parseInt(actionSeenMatch[1], 10);
    db.prepare('UPDATE action_items SET seen_by_ceo = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
    json(res, { ok: true });
    return;
  }

  // GET /api/activity
  if (method === 'GET' && url === '/api/activity') {
    const rows = db.prepare('SELECT * FROM team_activity ORDER BY created_at DESC').all();
    json(res, rows);
    return;
  }

  // POST /api/activity/:id/seen
  const activitySeenMatch = url.match(/^\/api\/activity\/(\d+)\/seen$/);
  if (method === 'POST' && activitySeenMatch) {
    const id = parseInt(activitySeenMatch[1], 10);
    db.prepare('UPDATE team_activity SET seen_by_ceo = 1 WHERE id = ?').run(id);
    json(res, { ok: true });
    return;
  }

  // GET /api/growth
  if (method === 'GET' && url === '/api/growth') {
    const rows = db.prepare('SELECT * FROM growth_log ORDER BY created_at DESC LIMIT 50').all();
    json(res, rows);
    return;
  }

  // POST /api/growth/:id/seen
  const growthSeenMatch = url.match(/^\/api\/growth\/(\d+)\/seen$/);
  if (method === 'POST' && growthSeenMatch) {
    const id = parseInt(growthSeenMatch[1], 10);
    db.prepare('UPDATE growth_log SET seen_by_ceo = 1 WHERE id = ?').run(id);
    json(res, { ok: true });
    return;
  }

  // POST /api/decisions/:id/seen
  const decisionSeenMatch = url.match(/^\/api\/decisions\/(\d+)\/seen$/);
  if (method === 'POST' && decisionSeenMatch) {
    const id = parseInt(decisionSeenMatch[1], 10);
    db.prepare('UPDATE decisions SET seen_by_ceo = 1 WHERE id = ?').run(id);
    json(res, { ok: true });
    return;
  }

  // GET /api/discussions
  if (method === 'GET' && url === '/api/discussions') {
    const threads = db.prepare('SELECT * FROM discussions WHERE parent_id IS NULL ORDER BY created_at DESC').all();
    const replies = db.prepare('SELECT * FROM discussions WHERE parent_id IS NOT NULL ORDER BY created_at ASC').all() as Array<{ parent_id: number; [key: string]: unknown }>;
    const replyMap: Record<number, unknown[]> = {};
    for (const r of replies) {
      if (!replyMap[r.parent_id]) replyMap[r.parent_id] = [];
      replyMap[r.parent_id].push(r);
    }
    const result = (threads as Array<{ id: number; [key: string]: unknown }>).map(t => ({ ...t, replies: replyMap[t.id] || [] }));
    json(res, result);
    return;
  }

  // POST /api/discussions
  if (method === 'POST' && url === '/api/discussions') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { team, title, content, category, parent_id } = JSON.parse(body);
        if (!team || !title || !content) { json(res, { error: 'team, title, content required' }, 400); return; }
        let depth = 0;
        if (parent_id) {
          const parent = db.prepare('SELECT depth FROM discussions WHERE id = ?').get(parent_id) as { depth: number } | undefined;
          depth = parent ? parent.depth + 1 : 1;
        }
        const stmt = db.prepare(`
          INSERT INTO discussions (team, title, content, category, parent_id, depth, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `);
        const result = stmt.run(team, title, content, category || 'insight', parent_id ?? null, depth);
        json(res, { ok: true, id: result.lastInsertRowid });
      } catch {
        json(res, { error: 'Invalid JSON' }, 400);
      }
    });
    return;
  }

  // POST /api/discussions/:id/seen
  const discussionSeenMatch = url.match(/^\/api\/discussions\/(\d+)\/seen$/);
  if (method === 'POST' && discussionSeenMatch) {
    const id = parseInt(discussionSeenMatch[1], 10);
    db.prepare('UPDATE discussions SET seen_by_ceo = 1 WHERE id = ?').run(id);
    json(res, { ok: true });
    return;
  }

  // POST /api/discussions/:id/upvote
  const discussionUpvoteMatch = url.match(/^\/api\/discussions\/(\d+)\/upvote$/);
  if (method === 'POST' && discussionUpvoteMatch) {
    const id = parseInt(discussionUpvoteMatch[1], 10);
    db.prepare('UPDATE discussions SET upvotes = upvotes + 1 WHERE id = ?').run(id);
    const row = db.prepare('SELECT upvotes FROM discussions WHERE id = ?').get(id) as { upvotes: number } | undefined;
    json(res, { ok: true, upvotes: row?.upvotes ?? 0 });
    return;
  }

  // PATCH /api/discussions/:id/status
  const discussionStatusMatch = url.match(/^\/api\/discussions\/(\d+)\/status$/);
  if (method === 'PATCH' && discussionStatusMatch) {
    const id = parseInt(discussionStatusMatch[1], 10);
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { status } = JSON.parse(body) as { status?: string };
        if (!status) { json(res, { error: 'status required' }, 400); return; }
        db.prepare('UPDATE discussions SET status = ? WHERE id = ?').run(status, id);
        json(res, { ok: true, id, status });
      } catch (_) {
        json(res, { error: 'invalid json' }, 400);
      }
    });
    return;
  }

  // GET /api/ceo-todos
  if (method === 'GET' && url === '/api/ceo-todos') {
    const rows = db.prepare("SELECT * FROM ceo_todos ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, id ASC").all();
    json(res, rows);
    return;
  }

  // POST /api/ceo-todos
  if (method === 'POST' && url === '/api/ceo-todos') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { title, description, priority, due_date } = JSON.parse(body);
        if (!title) { json(res, { error: 'title required' }, 400); return; }
        const now = new Date().toISOString();
        const result = db.prepare(`
          INSERT INTO ceo_todos (title, description, priority, status, due_date, created_at, updated_at)
          VALUES (?, ?, ?, 'todo', ?, ?, ?)
        `).run(title, description ?? null, priority ?? 'medium', due_date ?? null, now, now);
        json(res, { ok: true, id: result.lastInsertRowid });
      } catch {
        json(res, { error: 'Invalid JSON' }, 400);
      }
    });
    return;
  }

  // PATCH /api/ceo-todos/:id/status
  const todoStatusMatch = url.match(/^\/api\/ceo-todos\/(\d+)\/status$/);
  if (method === 'PATCH' && todoStatusMatch) {
    const id = parseInt(todoStatusMatch[1], 10);
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => {
      try {
        const { status } = JSON.parse(body) as { status?: string };
        if (!status) { json(res, { error: 'status required' }, 400); return; }
        db.prepare('UPDATE ceo_todos SET status = ?, updated_at = ? WHERE id = ?').run(status, new Date().toISOString(), id);
        json(res, { ok: true, id, status });
      } catch {
        json(res, { error: 'Invalid JSON' }, 400);
      }
    });
    return;
  }

  // DELETE /api/ceo-todos/:id
  const todoDeleteMatch = url.match(/^\/api\/ceo-todos\/(\d+)$/);
  if (method === 'DELETE' && todoDeleteMatch) {
    const id = parseInt(todoDeleteMatch[1], 10);
    db.prepare('DELETE FROM ceo_todos WHERE id = ?').run(id);
    json(res, { ok: true });
    return;
  }

  // GET /api/content-stats — live dev.to article stats (30min cache)
  if (method === 'GET' && url === '/api/content-stats') {
    const now = Date.now();
    if (!contentStatsCache || now - contentStatsCacheTime > 30 * 60 * 1000) {
      try {
        const devtoKey = process.env.DEVTO_API_KEY ?? '';
        const resp = await fetch('https://dev.to/api/articles/me?per_page=20', {
          headers: { 'api-key': devtoKey },
        });
        if (resp.ok) {
          const articles = (await resp.json()) as Array<{
            id: number; title: string; url: string;
            published_at: string | null; page_views_count: number;
            public_reactions_count: number; comments_count: number; tags: string[];
          }>;
          const published = articles.filter(a => a.published_at);
          contentStatsCache = {
            articles: published.map(a => ({
              id: a.id, title: a.title, url: a.url,
              publishedAt: a.published_at,
              views: a.page_views_count,
              reactions: a.public_reactions_count,
              comments: a.comments_count,
              tags: a.tags,
            })),
            totals: {
              count: published.length,
              views: published.reduce((s, a) => s + a.page_views_count, 0),
              reactions: published.reduce((s, a) => s + a.public_reactions_count, 0),
            },
            fetchedAt: new Date().toISOString(),
          };
          contentStatsCacheTime = now;
        }
      } catch (_) {}
    }
    json(res, contentStatsCache ?? { articles: [], totals: { count: 0, views: 0, reactions: 0 }, fetchedAt: null });
    return;
  }

  // GET /api/pipeline-health
  if (method === 'GET' && url === '/api/pipeline-health') {
    // Read from news.db (separate from dashboard.db)
    const newsDbPath = path.join(DATA_DIR, 'news.db');
    let articlesCount = 0;
    let analysesCount = 0;
    let lastArticle: string | null = null;
    let lastAnalysis: string | null = null;
    let optionsCount = 0;
    let lastOptions: string | null = null;
    try {
      const newsDb = new Database(newsDbPath, { readonly: true });
      articlesCount = (newsDb.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number }).c;
      analysesCount = (newsDb.prepare('SELECT COUNT(*) as c FROM analyses').get() as { c: number }).c;
      const lastA = newsDb.prepare('SELECT collected_at FROM articles ORDER BY id DESC LIMIT 1').get() as { collected_at: string } | undefined;
      lastArticle = lastA?.collected_at ?? null;
      const lastAn = newsDb.prepare('SELECT analyzed_at FROM analyses ORDER BY id DESC LIMIT 1').get() as { analyzed_at: string } | undefined;
      lastAnalysis = lastAn?.analyzed_at ?? null;
      try {
        optionsCount = (newsDb.prepare('SELECT COUNT(*) as c FROM options_snapshots').get() as { c: number }).c;
        const lastO = newsDb.prepare('SELECT created_at FROM options_snapshots ORDER BY id DESC LIMIT 1').get() as { created_at: string } | undefined;
        lastOptions = lastO?.created_at ?? null;
      } catch (_) {}
      newsDb.close();
    } catch (_) {}
    json(res, {
      articles: { count: articlesCount, lastAt: lastArticle, healthy: articlesCount > 0 },
      analyses: { count: analysesCount, lastAt: lastAnalysis, healthy: analysesCount > 0 },
      options: { count: optionsCount, lastAt: lastOptions, healthy: optionsCount > 0 },
    });
    return;
  }

  // POST /api/browser-post — CEO-triggered X post via Playwright browser session
  if (method === 'POST' && url === '/api/browser-post') {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', async () => {
      try {
        const { text } = JSON.parse(body) as { text?: string };
        if (!text || text.trim().length === 0) { json(res, { error: 'text required' }, 400); return; }
        if (text.length > 280) { json(res, { error: 'text too long (max 280)' }, 400); return; }
        // Import and execute browser poster
        const { postToTwitter } = await import('../growth/browser-poster.js');
        const ok = await postToTwitter(text.trim());
        if (ok) {
          // Log to growth_log
          db.prepare(`
            INSERT INTO growth_log (source, action, result, score, created_at)
            VALUES ('twitter', 'browser_post', ?, 1, datetime('now'))
          `).run(text.trim().substring(0, 120));
          json(res, { ok: true, message: 'Posted to X via browser' });
        } else {
          json(res, { ok: false, error: 'Browser post failed — check server logs' }, 500);
        }
      } catch (err) {
        console.error('[Dashboard] /api/browser-post error:', err);
        json(res, { error: String(err) }, 500);
      }
    });
    return;
  }

  // GET /api/browser-post/queue — return pre-written tweet drafts
  if (method === 'GET' && url === '/api/browser-post/queue') {
    const drafts = [
      {
        id: 1,
        text: `XLI options P/C hit 5.32 last week. Normal range: 0.5-1.2.\n\nAfter filtering $0.01 lottery calls: still 4.89. Real institutional hedging.\n\nBuilt the scanner with Claude Code. Open source.\ngithub.com/tellmefrankie/ai-investment-skills\n\n#ClaudeCode #options #algotrading`,
        label: 'XLI/CEG Scanner Story',
      },
      {
        id: 2,
        text: `RXRX raw P/C: 0.38 (extreme bullish).\nFiltered: 2.37 (bearish).\n\n84% of call volume was <$0.10 OTM noise.\nSignal completely inverted.\n\nClaude Code skill that does this:\ngithub.com/tellmefrankie/ai-investment-skills\n\n#options #ClaudeCode`,
        label: 'P/C Ratio Filter Story',
      },
      {
        id: 3,
        text: `6 AI agent skills for stock analysis, packaged as Claude Code tools.\n\nWhat they do:\n• Scan unusual options flow\n• Filter lottery calls from real hedges\n• Summarize SEC filings\n• Track insider transactions\n\nAll free. All open source.\n\ngithub.com/tellmefrankie/ai-investment-skills`,
        label: 'Skills Overview',
      },
    ];
    json(res, drafts);
    return;
  }

  notFound(res);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('[Dashboard] Unhandled error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[Dashboard] Server running at http://localhost:${PORT}`);
  console.log(`[Dashboard] Open http://localhost:${PORT} in your browser`);
});

process.on('SIGINT', () => {
  console.log('\n[Dashboard] Shutting down...');
  closeDashboardDb();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  closeDashboardDb();
  server.close(() => process.exit(0));
});
