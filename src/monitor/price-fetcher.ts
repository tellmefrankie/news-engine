import type { PriceResult } from './types.js';

const YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

/**
 * Fetch real-time stock price from Yahoo Finance API
 * No API key needed — public endpoint
 */
export async function fetchPrice(ticker: string): Promise<PriceResult | null> {
  const url = `${YAHOO_FINANCE_URL}/${ticker}?interval=1m&range=1d&includePrePost=true`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });

      if (!response.ok) {
        console.error(`[PriceFetcher] ${ticker}: HTTP ${response.status} (attempt ${attempt}/3)`);
        if (attempt < 3) await sleep(1000 * attempt);
        continue;
      }

      const data = await response.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        console.error(`[PriceFetcher] ${ticker}: No data in response`);
        return null;
      }

      const meta = result.meta;
      const prevClose = meta.chartPreviousClose || meta.previousClose;

      // Get latest actual candle price (includes pre/post market)
      let price = meta.regularMarketPrice;
      const closes = result?.indicators?.quote?.[0]?.close as (number | null)[] | undefined;
      if (closes) {
        for (let i = closes.length - 1; i >= 0; i--) {
          if (closes[i] !== null && closes[i] !== undefined) {
            price = closes[i] as number;
            break;
          }
        }
      }

      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        ticker,
        price: Math.round(price * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[PriceFetcher] ${ticker}: Error (attempt ${attempt}/3): ${msg}`);
      if (attempt < 3) await sleep(1000 * attempt);
    }
  }

  return null;
}

/**
 * Fetch prices for multiple tickers
 */
export async function fetchPrices(tickers: string[]): Promise<Map<string, PriceResult>> {
  const results = new Map<string, PriceResult>();

  // Fetch sequentially to avoid rate limiting
  for (const ticker of tickers) {
    const result = await fetchPrice(ticker);
    if (result) {
      results.set(ticker, result);
    }
    await sleep(300); // small delay between requests
  }

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
