import 'dotenv/config';
import cron from 'node-cron';
import { Bot } from 'grammy';
import { fetchPrices } from './price-fetcher.js';
import { checkAlerts, formatPriceSummary } from './alert-checker.js';
import type { WatchItem } from './types.js';

// ===== WATCHLIST CONFIGURATION =====
// Update this when positions change
const WATCHLIST: WatchItem[] = [
  { ticker: 'IREN', stopLoss: 39.0, action: '전량 매도 (종가 기준)' },
  { ticker: 'TEM', stopLoss: 49.75, action: '장 시작 매도' },
  { ticker: 'RXRX', stopLoss: 2.85, action: '토스 전량 매도' },
  { ticker: 'KTOS', stopLoss: 52.0, action: '전량 매도' },
  { ticker: 'CEG', stopLoss: 253.0, action: '50% 매도' },
  { ticker: 'AMBA', stopLoss: 64.0, action: '워치리스트 진입가 도달 — 매수 검토 $2,500' },
  { ticker: 'MP', stopLoss: 58.0, action: '전량 매도 (40주)' },
];

const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHANNEL_ID || '';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

async function sendTelegramAlert(message: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('[Monitor] Telegram credentials not set');
    return;
  }

  try {
    const bot = new Bot(TELEGRAM_BOT_TOKEN);
    await bot.api.sendMessage(TELEGRAM_CHAT_ID, message);
    console.log('[Monitor] Telegram alert sent');
  } catch (error) {
    console.error('[Monitor] Failed to send Telegram alert:', error);
  }
}

function isMarketHours(): { open: boolean; status: string } {
  const now = new Date();
  // Convert to ET (UTC-4 during EDT)
  const etOffset = -4 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etMinutes = utcMinutes + etOffset;
  const etHour = Math.floor(((etMinutes % 1440) + 1440) % 1440 / 60);

  // Pre-market: 4:00-9:30 ET
  if (etHour >= 4 && (etHour < 9 || (etHour === 9 && now.getUTCMinutes() < 30))) {
    return { open: true, status: 'PRE-MARKET' };
  }
  // Regular: 9:30-16:00 ET
  if ((etHour > 9 || (etHour === 9 && now.getUTCMinutes() >= 30)) && etHour < 16) {
    return { open: true, status: 'MARKET OPEN' };
  }
  // After-hours: 16:00-20:00 ET
  if (etHour >= 16 && etHour < 20) {
    return { open: true, status: 'AFTER-HOURS' };
  }

  // Weekend check
  const day = now.getUTCDay();
  if (day === 0 || day === 6) {
    return { open: false, status: 'WEEKEND' };
  }

  return { open: false, status: 'MARKET CLOSED' };
}

async function runPriceCheck(): Promise<void> {
  const market = isMarketHours();

  if (!market.open) {
    console.log(`[Monitor] ${market.status} — skipping price check`);
    return;
  }

  console.log(`[Monitor] ${market.status} — checking prices...`);

  const tickers = WATCHLIST.map((w) => w.ticker);
  const prices = await fetchPrices(tickers);

  if (prices.size === 0) {
    console.error('[Monitor] Failed to fetch any prices');
    return;
  }

  // Log summary
  const summary = formatPriceSummary(prices, WATCHLIST);
  console.log(summary);

  // Check for alerts
  const alerts = checkAlerts(prices, WATCHLIST);

  if (alerts.length > 0) {
    for (const alert of alerts) {
      console.log(`[Monitor] ALERT: ${alert.message}`);
      await sendTelegramAlert(alert.message);
    }
  } else {
    console.log('[Monitor] No alerts triggered');
  }
}

// ===== CLI MODE =====
function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--once')) {
    // Single check mode
    console.log('[Monitor] Running single price check...');
    runPriceCheck().then(() => {
      console.log('[Monitor] Done');
    });
    return;
  }

  // Scheduler mode — check every 5 minutes during market hours
  const schedule = process.env.MONITOR_SCHEDULE || '*/5 * * * *';

  console.log('[Monitor] ============================');
  console.log('[Monitor] Price Monitor Started');
  console.log('[Monitor] ============================');
  console.log(`[Monitor] Schedule: ${schedule}`);
  console.log(`[Monitor] Watching: ${WATCHLIST.map((w) => w.ticker).join(', ')}`);
  console.log(`[Monitor] Telegram: ${TELEGRAM_CHAT_ID ? 'configured' : 'NOT SET'}`);
  console.log('[Monitor] Waiting for next check...');

  // Run immediately on start
  runPriceCheck();

  // Then schedule
  cron.schedule(schedule, () => {
    runPriceCheck();
  }, {
    timezone: 'America/New_York',
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('[Monitor] Shutting down...');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
