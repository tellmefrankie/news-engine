/**
 * capture-thumbnails.ts
 * Playwright로 thumbnails.html에서 각 썸네일을 PNG로 캡처
 *
 * Usage:
 *   npx tsx src/dashboard/capture-thumbnails.ts
 *
 * Output:
 *   src/dashboard/images/devto-cover.png    (1000x420)
 *   src/dashboard/images/gumroad-thumb.png  (600x600)
 *   src/dashboard/images/agensi-promo.png   (800x400)
 */

import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const THUMBNAILS_HTML = path.resolve(__dirname, 'thumbnails.html');
const OUTPUT_DIR = path.resolve(__dirname, 'images');

const TARGETS = [
  { id: 'devto-cover',   width: 1000, height: 420,  out: 'devto-cover.png' },
  { id: 'gumroad-thumb', width: 600,  height: 600,  out: 'gumroad-thumb.png' },
  { id: 'agensi-promo',  width: 800,  height: 400,  out: 'agensi-promo.png' },
];

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  console.log('[capture] Browser launched');

  for (const target of TARGETS) {
    const page = await browser.newPage();

    // Set viewport large enough to render without clipping
    await page.setViewportSize({ width: target.width + 200, height: target.height + 200 });
    await page.goto(`file://${THUMBNAILS_HTML}`);
    await page.waitForLoadState('networkidle');

    const el = page.locator(`#${target.id}`);
    const outPath = path.join(OUTPUT_DIR, target.out);

    await el.screenshot({ path: outPath });
    console.log(`[capture] ${target.out} → ${outPath}`);

    await page.close();
  }

  await browser.close();
  console.log('[capture] Done. Files saved to', OUTPUT_DIR);
}

capture().catch(err => {
  console.error('[capture] Error:', err);
  process.exit(1);
});
