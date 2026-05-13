import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getDb } from '../db/index.js';
import { getLatestSnapshots } from './queries.js';
import { formatSentimentTable } from './formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function snapshotPngPath(date: string): string {
  return path.join(ASSETS_DIR, `snapshot-${date}.png`);
}

export interface SnapshotPngResult {
  path: string;
  generatedAt: string;
  cached: boolean;
}

/**
 * Generate (or return cached) a PNG of today's options sentiment table.
 * Uses headless Playwright to render an HTML table and screenshot it.
 */
export async function generateSnapshotPng(): Promise<SnapshotPngResult> {
  const date = todayStr();
  const pngPath = snapshotPngPath(date);

  if (fs.existsSync(pngPath)) {
    const stat = fs.statSync(pngPath);
    return { path: pngPath, generatedAt: stat.mtime.toISOString(), cached: true };
  }

  const db = getDb();
  const snapshots = getLatestSnapshots(db);
  const tableText = formatSentimentTable(snapshots);

  const html = buildHtml(tableText, date);

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(html, { waitUntil: 'load' });
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await page.close();
  } finally {
    await browser.close();
  }

  return { path: pngPath, generatedAt: new Date().toISOString(), cached: false };
}

function buildHtml(tableText: string, date: string): string {
  const rows = tableText
    .split('\n')
    .filter(l => l.trim())
    .map(line => {
      // Section headers (no |)
      if (!line.includes('|')) {
        return `<tr><td colspan="4" class="section">${esc(line)}</td></tr>`;
      }
      const parts = line.split('|').map(p => p.trim());
      return '<tr>' + parts.map(p => `<td>${esc(p)}</td>`).join('') + '</tr>';
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #0d1117;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #e6edf3;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    padding: 32px;
  }
  h1 { font-size: 22px; color: #58a6ff; margin-bottom: 6px; letter-spacing: 0.5px; }
  .date { font-size: 13px; color: #8b949e; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; }
  td { padding: 6px 16px; border-bottom: 1px solid #21262d; }
  td.section { color: #8b949e; font-size: 12px; padding-top: 14px; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
  tr:hover td { background: #161b22; }
  td:first-child { color: #f0f6fc; font-weight: 700; }
  .footer { margin-top: 18px; font-size: 11px; color: #484f58; }
</style>
</head>
<body>
  <h1>Options Sentiment</h1>
  <div class="date">${date}</div>
  <table>${rows}</table>
  <div class="footer">github.com/tellmefrankie/news-engine</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
