/**
 * Thumbnail Generator — creates dev.to cover images using Playwright
 * Renders HTML templates to PNG at 1000x420px (dev.to recommended size)
 */

import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const OUTPUT_DIR = path.join(process.env.HOME || '/Users/jaehyun', 'Desktop/Projects/news-engine/content/thumbnails');

interface ThumbnailConfig {
  title: string;
  subtitle?: string;
  tag?: string;
  metric?: string;
  metricLabel?: string;
  outputFile: string;
  theme?: 'dark' | 'finance' | 'code';
}

function buildHtml(config: ThumbnailConfig): string {
  const { title, subtitle, tag, metric, metricLabel, theme = 'dark' } = config;

  const themes = {
    dark: {
      bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      accent: '#3b82f6',
      accentLight: '#60a5fa',
      text: '#f1f5f9',
      subtext: '#94a3b8',
      border: '#334155',
      tagBg: '#1e40af',
      tagText: '#bfdbfe',
    },
    finance: {
      bg: 'linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%)',
      accent: '#10b981',
      accentLight: '#34d399',
      text: '#f0fdf4',
      subtext: '#86efac',
      border: '#166534',
      tagBg: '#064e3b',
      tagText: '#6ee7b7',
    },
    code: {
      bg: 'linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #1a0533 100%)',
      accent: '#a78bfa',
      accentLight: '#c4b5fd',
      text: '#faf5ff',
      subtext: '#c4b5fd',
      border: '#4c1d95',
      tagBg: '#2e1065',
      tagText: '#e9d5ff',
    },
  };

  const t = themes[theme];

  const metricHtml = metric ? `
    <div class="metric-block">
      <div class="metric-value">${metric}</div>
      ${metricLabel ? `<div class="metric-label">${metricLabel}</div>` : ''}
    </div>
  ` : '';

  const tagHtml = tag ? `
    <div class="tag">${tag}</div>
  ` : '';

  const subtitleHtml = subtitle ? `
    <div class="subtitle">${subtitle}</div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    width: 1000px;
    height: 420px;
    background: ${t.bg};
    font-family: -apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
    overflow: hidden;
    position: relative;
  }

  /* Grid pattern overlay */
  body::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(${t.border}22 1px, transparent 1px),
      linear-gradient(90deg, ${t.border}22 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }

  /* Glow effect */
  body::after {
    content: '';
    position: absolute;
    top: -50%;
    left: 20%;
    width: 60%;
    height: 200%;
    background: radial-gradient(ellipse, ${t.accent}15 0%, transparent 70%);
    pointer-events: none;
  }

  .container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 100%;
    padding: 40px 52px;
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tag {
    background: ${t.tagBg};
    color: ${t.tagText};
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid ${t.accent}40;
  }

  .metric-block {
    text-align: right;
  }

  .metric-value {
    font-size: 32px;
    font-weight: 800;
    color: ${t.accentLight};
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .metric-label {
    font-size: 11px;
    color: ${t.subtext};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 4px;
  }

  .middle {
    flex: 1;
    display: flex;
    align-items: center;
    padding: 20px 0;
  }

  .title {
    font-size: 34px;
    font-weight: 800;
    color: ${t.text};
    line-height: 1.25;
    max-width: 820px;
    letter-spacing: -0.02em;
  }

  .title em {
    color: ${t.accentLight};
    font-style: normal;
  }

  .subtitle {
    font-size: 18px;
    color: ${t.subtext};
    line-height: 1.5;
    margin-top: 12px;
    max-width: 720px;
  }

  .bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .author {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .author-dot {
    width: 8px;
    height: 8px;
    background: ${t.accent};
    border-radius: 50%;
  }

  .author-name {
    font-size: 14px;
    color: ${t.subtext};
    font-weight: 500;
  }

  .accent-line {
    width: 48px;
    height: 3px;
    background: linear-gradient(90deg, ${t.accent}, transparent);
    border-radius: 2px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="top">
      ${tagHtml}
      ${metricHtml}
    </div>
    <div class="middle">
      <div>
        <div class="title">${title}</div>
        ${subtitleHtml}
      </div>
    </div>
    <div class="bottom">
      <div class="author">
        <div class="author-dot"></div>
        <div class="author-name">tellmefrankie · dev.to</div>
      </div>
      <div class="accent-line"></div>
    </div>
  </div>
</body>
</html>`;
}

export async function generateThumbnail(config: ThumbnailConfig): Promise<string> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const html = buildHtml(config);
  const htmlPath = path.join(OUTPUT_DIR, `${config.outputFile}.html`);
  const pngPath = path.join(OUTPUT_DIR, `${config.outputFile}.png`);

  fs.writeFileSync(htmlPath, html, 'utf8');

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1000, height: 420 });
  await page.goto(`file://${htmlPath}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: pngPath, type: 'png' });
  await browser.close();

  console.log(`[Thumbnail] Generated: ${pngPath}`);
  return pngPath;
}

// CLI: npx tsx src/growth/thumbnail-generator.ts
if (import.meta.url === `file://${process.argv[1]}`) {
  const configs: ThumbnailConfig[] = [
    {
      title: 'I built a real-time options flow scanner with <em>Claude Code</em>',
      subtitle: 'Separate real institutional trades from retail lottery tickets automatically',
      tag: '#ShowDev',
      metric: 'XLI 5.32',
      metricLabel: 'P/C ratio caught',
      outputFile: 'options-flow-scanner',
      theme: 'finance',
    },
    {
      title: '98% of These Call Options Are <em>Lottery Tickets</em>',
      subtitle: 'How to filter them automatically — and why it changes everything',
      tag: '#Investing',
      metric: '98%',
      metricLabel: 'CEG lottery calls',
      outputFile: 'lottery-tickets',
      theme: 'finance',
    },
    {
      title: 'I built 6 AI agent skills that run before my <em>morning coffee</em>',
      subtitle: 'Options flow, stop-loss alerts, daily briefing — all automated',
      tag: '#ShowDev',
      metric: '90s',
      metricLabel: 'full briefing runtime',
      outputFile: 'morning-coffee',
      theme: 'dark',
    },
    {
      title: 'When the Market Whispers Through <em>Sector ETFs</em>',
      subtitle: 'XLI P/C 5.32 — what institutional put buying at 4x baseline means',
      tag: '#AlgoTrading',
      metric: '5.32',
      metricLabel: 'XLI put/call ratio',
      outputFile: 'xli-signal',
      theme: 'finance',
    },
    {
      title: 'How I detect options flow anomalies with <em>Claude Code</em>',
      subtitle: 'Statistical outlier detection across 6 tickers — with real examples',
      tag: '#Python',
      metric: '6 tickers',
      metricLabel: 'daily scan',
      outputFile: 'anomaly-detection',
      theme: 'code',
    },
  ];

  (async () => {
    console.log(`[Thumbnail] Generating ${configs.length} thumbnails...`);
    for (const config of configs) {
      try {
        const output = await generateThumbnail(config);
        console.log(`  OK: ${output}`);
      } catch (err) {
        console.error(`  FAIL ${config.outputFile}:`, err);
      }
    }
    console.log('[Thumbnail] Done.');
    process.exit(0);
  })();
}
