import type { WatchItem, PriceResult, PriceAlert } from './types.js';

// Track sent alerts to avoid duplicates
const sentAlerts = new Map<string, number>(); // key -> timestamp
const ALERT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same alerts

function shouldSendAlert(key: string): boolean {
  const lastSent = sentAlerts.get(key);
  if (!lastSent) return true;
  return Date.now() - lastSent > ALERT_COOLDOWN_MS;
}

function markAlertSent(key: string): void {
  sentAlerts.set(key, Date.now());
}

/**
 * Check prices against watchlist and generate alerts
 * Only sends each alert type once per 30 minutes per ticker
 */
export function checkAlerts(
  prices: Map<string, PriceResult>,
  watchlist: WatchItem[],
): PriceAlert[] {
  const alerts: PriceAlert[] = [];

  for (const item of watchlist) {
    const price = prices.get(item.ticker);
    if (!price) continue;

    // Stop-loss check
    if (price.price <= item.stopLoss) {
      const key = `stop_${item.ticker}`;
      if (shouldSendAlert(key)) {
        alerts.push({
          type: 'stop_loss',
          ticker: item.ticker,
          currentPrice: price.price,
          triggerPrice: item.stopLoss,
          action: item.action,
          message: `🚨 손절 알림: ${item.ticker} $${price.price} — 손절가 $${item.stopLoss} 도달. ${item.action}`,
        });
        markAlertSent(key);
      }
    }

    // Significant move alert (>5% daily change)
    if (Math.abs(price.changePercent) >= 5) {
      const direction = price.changePercent > 0 ? '급등' : '급락';
      const key = `move_${item.ticker}_${direction}`;
      if (shouldSendAlert(key)) {
        alerts.push({
          type: 'significant_move',
          ticker: item.ticker,
          currentPrice: price.price,
          triggerPrice: 0,
          action: '확인 필요',
          message: `⚡ ${item.ticker} ${direction}: $${price.price} (${price.changePercent > 0 ? '+' : ''}${price.changePercent}%)`,
        });
        markAlertSent(key);
      }
    }
  }

  return alerts;
}

/**
 * Format price summary for logging
 */
export function formatPriceSummary(
  prices: Map<string, PriceResult>,
  watchlist: WatchItem[],
): string {
  const lines: string[] = ['📊 가격 체크 결과:'];

  for (const item of watchlist) {
    const price = prices.get(item.ticker);
    if (!price) {
      lines.push(`  ${item.ticker}: 데이터 없음 ❌`);
      continue;
    }

    const changeStr = `${price.changePercent >= 0 ? '+' : ''}${price.changePercent}%`;
    const margin = ((price.price - item.stopLoss) / item.stopLoss * 100).toFixed(1);
    const status = price.price <= item.stopLoss ? '🚨 손절!' :
                   parseFloat(margin) < 5 ? '⚠️' : '✅';

    lines.push(`  ${item.ticker}: $${price.price} (${changeStr}) | 손절 $${item.stopLoss} | 여유 ${margin}% ${status}`);
  }

  return lines.join('\n');
}
