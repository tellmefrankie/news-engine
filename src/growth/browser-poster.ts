import { chromium } from 'playwright-core';
import path from 'path';

/**
 * Browser-based poster using CEO's Chrome profile (logged-in sessions).
 * No API keys needed — uses existing browser cookies.
 */

const CHROME_USER_DATA = path.join(
  process.env.HOME || '/Users/jaehyun',
  'Library/Application Support/Google/Chrome'
);

async function launchWithProfile(): Promise<ReturnType<typeof chromium.launchPersistentContext>> {
  // Close Chrome first if running (can't share profile)
  try {
    const { execSync } = await import('child_process');
    execSync('pkill -x "Google Chrome" 2>/dev/null || true');
    await new Promise(r => setTimeout(r, 2000));
  } catch {}

  const context = await chromium.launchPersistentContext(
    CHROME_USER_DATA,
    {
      headless: false,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--disable-blink-features=AutomationControlled',
      ],
      viewport: { width: 1280, height: 800 },
    }
  );
  return context;
}

export async function postToTwitter(text: string): Promise<boolean> {
  console.log('[Browser] Posting to X/Twitter...');
  const context = await launchWithProfile();
  const page = await context.newPage();

  try {
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(3000);

    // Type in the tweet compose box
    const editor = page.locator('[data-testid="tweetTextarea_0"]');
    await editor.click();
    await editor.fill(text);
    await page.waitForTimeout(1000);

    // Click Post button
    const postBtn = page.locator('[data-testid="tweetButton"]');
    await postBtn.click();
    await page.waitForTimeout(3000);

    console.log('[Browser] Tweet posted successfully!');
    return true;
  } catch (error) {
    console.error('[Browser] Twitter post failed:', error);
    return false;
  } finally {
    await context.close();
  }
}

// CLI
const args = process.argv.slice(2);
if (args.includes('--twitter')) {
  const tweet = `I built 6 Claude Code skills for investment analysis — open source.

My scanner caught XLI P/C at 5.32 (normal: 0.5-1.2). 98% of CEG's call volume was $0.01 lottery tickets.

Raw P/C said "neutral." Adjusted P/C said "extremely bearish."

Free on GitHub: github.com/tellmefrankie/ai-investment-skills

#ClaudeCode #BuildInPublic #algotrading`;

  postToTwitter(tweet).then(ok => {
    console.log('Result:', ok);
    process.exit(ok ? 0 : 1);
  });
}
