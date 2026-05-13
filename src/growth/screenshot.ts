import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../content/screenshots');

async function takeScreenshot(url: string, filename: string, opts: { width?: number; height?: number; fullPage?: boolean } = {}): Promise<string> {
  const { width = 1280, height = 800, fullPage = true } = opts;
  if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); // wait for data to load

  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage });
  await browser.close();

  console.log(`[Screenshot] Saved: ${filepath}`);
  return filepath;
}

async function main(): Promise<void> {
  const date = new Date().toISOString().split('T')[0];

  // Dashboard overview
  console.log('[Screenshot] Capturing dashboard...');
  await takeScreenshot('http://localhost:3847', `dashboard-${date}.png`);

  // Dashboard each tab
  const tabs = ['actions', 'teams', 'growth', 'accounts'];
  for (const tab of tabs) {
    console.log(`[Screenshot] Capturing ${tab} tab...`);
    await takeScreenshot(`http://localhost:3847#tab-${tab}`, `dashboard-${tab}-${date}.png`);
  }

  console.log('[Screenshot] All screenshots captured!');
}

main().catch(console.error);
