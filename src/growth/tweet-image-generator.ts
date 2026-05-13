/**
 * Tweet Image Generator
 * Creates terminal-output and data-table style images for X posts.
 * Output: 1200x675px (Twitter recommended card size)
 */

import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(
  process.env.HOME || '/Users/jaehyun',
  'Desktop/Projects/news-engine/content/tweet-images'
);

// ── Terminal output style ──────────────────────────────────────────────────
function terminalHtml(lines: string[], title = 'OPTIONS FLOW SCANNER'): string {
  const lineHtml = lines
    .map(line => {
      // Colorize specific patterns
      let colored = line
        .replace(/\[EXTREME BULLISH\]/g, '<span class="eb">[EXTREME BULLISH]</span>')
        .replace(/\[BULLISH\]/g, '<span class="b">[BULLISH]</span>')
        .replace(/\[NEUTRAL\]/g, '<span class="n">[NEUTRAL]</span>')
        .replace(/\[CAUTIOUS\]/g, '<span class="c">[CAUTIOUS]</span>')
        .replace(/\[BEARISH.*?\]/g, '<span class="bear">$&</span>')
        .replace(/\[OUTLIER.*?\]/g, '<span class="outlier">$&</span>')
        .replace(/⚠/g, '<span class="warn">⚠</span>')
        .replace(/✓/g, '<span class="ok">✓</span>')
        .replace(/(\d+\.\d+)/g, '<span class="num">$1</span>');
      return `<div class="line">${colored}</div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 675px;
    background: #0d1117;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .titlebar {
    background: #161b22;
    border-bottom: 1px solid #30363d;
    padding: 12px 20px;
    display: flex; align-items: center; gap: 12px;
  }
  .dots { display: flex; gap: 8px; }
  .dot { width: 12px; height: 12px; border-radius: 50%; }
  .dot.r { background: #ff5f57; }
  .dot.y { background: #febc2e; }
  .dot.g { background: #28c840; }
  .title-text { color: #8b949e; font-size: 13px; flex: 1; text-align: center; }
  .terminal {
    flex: 1; padding: 24px 32px;
    display: flex; flex-direction: column; justify-content: center;
    gap: 2px;
  }
  .line {
    font-size: 18px; line-height: 1.7; color: #e6edf3;
    white-space: pre;
  }
  .line:empty { height: 1.7em; }
  .eb  { color: #3fb950; font-weight: 700; }
  .b   { color: #58a6ff; }
  .n   { color: #8b949e; }
  .c   { color: #d29922; }
  .bear{ color: #f85149; font-weight: 700; }
  .outlier { color: #ff7b72; font-weight: 700; background: #3d1a1a; padding: 0 4px; border-radius: 3px; }
  .warn { color: #f85149; }
  .ok  { color: #3fb950; }
  .num { color: #e3b341; }
  .watermark {
    padding: 8px 32px 14px;
    color: #30363d; font-size: 12px; text-align: right;
  }
</style>
</head>
<body>
  <div class="titlebar">
    <div class="dots">
      <div class="dot r"></div>
      <div class="dot y"></div>
      <div class="dot g"></div>
    </div>
    <div class="title-text">${title}</div>
  </div>
  <div class="terminal">${lineHtml}</div>
  <div class="watermark">github.com/tellmefrankie/news-engine</div>
</body>
</html>`;
}

// ── Data table style ───────────────────────────────────────────────────────
interface TableRow {
  ticker: string;
  value: string;
  label: string;
  signal: 'bullish' | 'neutral' | 'bearish' | 'outlier';
}

function tableHtml(rows: TableRow[], title: string, subtitle?: string): string {
  const signalColors: Record<TableRow['signal'], string> = {
    bullish: '#3fb950',
    neutral: '#8b949e',
    bearish: '#f85149',
    outlier: '#ff7b72',
  };
  const signalBg: Record<TableRow['signal'], string> = {
    bullish: '#0d2a14',
    neutral: '#161b22',
    bearish: '#2a0d0d',
    outlier: '#3d1a1a',
  };

  const rowsHtml = rows.map(r => `
    <tr style="background:${signalBg[r.signal]}">
      <td class="ticker">${r.ticker}</td>
      <td class="value" style="color:${signalColors[r.signal]}">${r.value}</td>
      <td class="label" style="color:${signalColors[r.signal]}">${r.label}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 675px;
    background: linear-gradient(135deg, #0a1628 0%, #0d2137 100%);
    font-family: -apple-system, 'SF Pro Display', system-ui, sans-serif;
    display: flex; flex-direction: column;
    padding: 48px 64px;
    overflow: hidden;
  }
  h1 {
    font-size: 28px; font-weight: 800;
    color: #f0fdf4; letter-spacing: -0.02em;
    margin-bottom: 6px;
  }
  .subtitle {
    font-size: 15px; color: #86efac; margin-bottom: 32px;
  }
  table {
    width: 100%; border-collapse: collapse;
    font-family: 'SF Mono', monospace;
  }
  thead th {
    font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.1em; color: #4b6a4b;
    padding: 0 20px 10px; text-align: left;
    border-bottom: 1px solid #1a3a1a;
  }
  tbody tr {
    border-bottom: 1px solid #0f2a0f;
  }
  td { padding: 14px 20px; }
  .ticker { font-size: 20px; font-weight: 700; color: #e6edf3; width: 100px; }
  .value  { font-size: 24px; font-weight: 800; width: 120px; }
  .label  { font-size: 14px; font-weight: 600; }
  .footer {
    margin-top: auto; display: flex;
    justify-content: space-between; align-items: center;
    padding-top: 24px;
  }
  .date { font-size: 13px; color: #4b6a4b; }
  .source { font-size: 12px; color: #2d4a2d; }
</style>
</head>
<body>
  <h1>${title}</h1>
  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
  <table>
    <thead>
      <tr>
        <th>Ticker</th>
        <th>P/C Ratio</th>
        <th>Signal</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    <div class="date">${new Date().toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'})}</div>
    <div class="source">github.com/tellmefrankie/news-engine</div>
  </div>
</body>
</html>`;
}

// ── Render to PNG ──────────────────────────────────────────────────────────
async function renderToPng(html: string, filename: string): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const htmlPath = path.join(OUTPUT_DIR, `${filename}.html`);
  const pngPath  = path.join(OUTPUT_DIR, `${filename}.png`);
  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 675 });
  await page.goto(`file://${htmlPath}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: pngPath, type: 'png' });
  await browser.close();

  console.log(`[TweetImg] ${pngPath}`);
  return pngPath;
}

// ── Preset images for Discussion #17 drafts ───────────────────────────────
async function generateAll(): Promise<void> {
  // Tweet A: XLI 5.32 signal — terminal style
  await renderToPng(terminalHtml([
    '=== OPTIONS FLOW SUMMARY — 2026-05-13 ===',
    '',
    'SPY   P/C: 0.44   [EXTREME BULLISH]',
    'QQQ   P/C: 0.54   [BULLISH]',
    'TEM   P/C: 0.50   [BULLISH]',
    'RXRX  P/C: 0.38   [EXTREME BULLISH]',
    'IREN  P/C: 0.83   [NEUTRAL]',
    'XLI   P/C: 5.32   [OUTLIER — INSTITUTIONAL HEDGE SIGNAL] ⚠',
    '',
    'Normal XLI range: 0.5–1.2',
    'Current reading: 4.4x above baseline',
  ], 'OPTIONS FLOW SCANNER — morning run'), 'tweet-a-xli-terminal');

  // Tweet B: real vs lottery — terminal style
  await renderToPng(terminalHtml([
    '=== CEG OPTIONS ANALYSIS ===',
    '',
    'Raw P/C ratio:      0.20   → [EXTREME BULLISH]',
    '',
    'Filtering lottery calls (bid < $0.10, OTM > 5%)...',
    '',
    'Lottery calls:      98.4%  of total call volume',
    'Real calls:          1.6%',
    '',
    'Adjusted P/C:       1.06   → [NEUTRAL/BEARISH]',
    '',
    '⚠  Raw signal was wrong. Institutional call interest: gone.',
  ], 'REAL vs LOTTERY CALL FILTER'), 'tweet-b-lottery-filter');

  // Tweet C: sector flow table
  await renderToPng(tableHtml([
    { ticker: 'SPY',  value: '0.44', label: 'EXTREME BULLISH — broad market pricing in upside', signal: 'bullish' },
    { ticker: 'QQQ',  value: '0.54', label: 'BULLISH — tech names confirming', signal: 'bullish' },
    { ticker: 'IREN', value: '0.83', label: 'NEUTRAL', signal: 'neutral' },
    { ticker: 'XLI',  value: '5.32', label: 'OUTLIER — institutional downside hedge on industrials', signal: 'outlier' },
  ],
  'Sector ETF Options Flow Divergence',
  'When the index says bullish but one sector says otherwise'
  ), 'tweet-c-sector-table');

  console.log('[TweetImg] All done. Files in:', OUTPUT_DIR);
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}

export { terminalHtml, tableHtml, renderToPng, generateAll };
