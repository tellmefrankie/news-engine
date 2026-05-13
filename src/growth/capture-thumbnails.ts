import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../content/screenshots');
const THUMBNAILS_HTML = path.resolve(__dirname, '../dashboard/thumbnails.html');

async function main(): Promise<void> {
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const targets = [
    { id: 'devto-cover', width: 1000, height: 420, file: 'devto-cover.png' },
    { id: 'gumroad-thumb', width: 600, height: 600, file: 'gumroad-thumb.png' },
    { id: 'agensi-promo', width: 800, height: 400, file: 'agensi-promo.png' },
  ];

  for (const t of targets) {
    const page = await browser.newPage({ viewport: { width: t.width, height: t.height } });
    await page.goto(`file://${THUMBNAILS_HTML}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const el = await page.$(`#${t.id}`);
    if (el) {
      const filepath = path.join(SCREENSHOTS_DIR, t.file);
      await el.screenshot({ path: filepath });
      console.log(`[Thumbnail] ${t.file} saved (${t.width}x${t.height})`);
    } else {
      console.error(`[Thumbnail] #${t.id} not found`);
    }
    await page.close();
  }

  await browser.close();
  console.log('[Thumbnail] All thumbnails captured!');
}

main().catch(console.error);
