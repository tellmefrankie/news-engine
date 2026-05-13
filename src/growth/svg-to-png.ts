/**
 * svg-to-png.ts
 * Convert SVG thumbnails in assets/ to PNG using Playwright (headless Chromium).
 * X/Twitter requires PNG or JPG — SVG is not supported.
 *
 * Usage:
 *   npx tsx src/growth/svg-to-png.ts
 *
 * Output:
 *   assets/thumb-xli-anomaly.png
 *   assets/thumb-rxrx-inverted.png
 *   assets/thumb-6-skills.png
 *   assets/thumb-stop-loss-monitor.png
 *   assets/thumb-ev-calculator.png
 */

import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

const SVG_FILES = [
  'thumb-xli-anomaly',
  'thumb-rxrx-inverted',
  'thumb-6-skills',
  'thumb-stop-loss-monitor',
  'thumb-ev-calculator',
];

async function svgToPng(browser: Awaited<ReturnType<typeof chromium.launch>>, svgPath: string, pngPath: string): Promise<void> {
  const page = await browser.newPage();
  // 1200x630 is the OG image standard size
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(`file://${svgPath}`, { waitUntil: 'load' });
  await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
  await page.close();
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  let converted = 0;

  for (const name of SVG_FILES) {
    const svgPath = path.join(ASSETS_DIR, `${name}.svg`);
    const pngPath = path.join(ASSETS_DIR, `${name}.png`);

    if (!fs.existsSync(svgPath)) {
      console.warn(`[svg-to-png] Skipping ${name}.svg — file not found`);
      continue;
    }

    try {
      await svgToPng(browser, svgPath, pngPath);
      const size = fs.statSync(pngPath).size;
      console.log(`[svg-to-png] ${name}.png (${(size / 1024).toFixed(0)}KB)`);
      converted++;
    } catch (err) {
      console.error(`[svg-to-png] Failed: ${name}`, err);
    }
  }

  await browser.close();
  console.log(`[svg-to-png] Done. ${converted}/${SVG_FILES.length} converted → ${ASSETS_DIR}`);
}

main().catch(err => {
  console.error('[svg-to-png] Fatal:', err);
  process.exit(1);
});
