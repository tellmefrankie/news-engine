import type { MarketDataProvider, OptionsSnapshot, ShortInterest, EarningsHistory } from '../types.js';

const YAHOO_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_BASE2 = 'https://query2.finance.yahoo.com';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

let _crumb: string | null = null;
let _cookie: string | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Get Yahoo Finance auth cookie + crumb */
async function getAuth(): Promise<{ cookie: string; crumb: string } | null> {
  if (_crumb && _cookie) return { cookie: _cookie, crumb: _crumb };

  try {
    // Step 1: Get consent cookie
    const consentRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
    });
    const setCookies = consentRes.headers.getSetCookie?.() ?? [];
    const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');

    // Step 2: Get crumb
    const crumbRes = await fetch(`${YAHOO_BASE2}/v1/test/getcrumb`, {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
    });
    if (!crumbRes.ok) return null;
    const crumb = await crumbRes.text();

    _crumb = crumb;
    _cookie = cookie;
    return { cookie, crumb };
  } catch {
    console.error('[Yahoo] Failed to get auth');
    return null;
  }
}

async function yahooFetch(url: string, useAuth = false): Promise<unknown | null> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const headers: Record<string, string> = { 'User-Agent': USER_AGENT };

      if (useAuth) {
        const auth = await getAuth();
        if (auth) {
          headers['Cookie'] = auth.cookie;
          const separator = url.includes('?') ? '&' : '?';
          url = `${url}${separator}crumb=${encodeURIComponent(auth.crumb)}`;
        }
      }

      const response = await fetch(url, { headers });
      if (response.status === 401 && !useAuth) {
        // Retry with auth
        return yahooFetch(url, true);
      }
      if (!response.ok) {
        console.error(`[Yahoo] HTTP ${response.status} for ${url} (attempt ${attempt}/3)`);
        if (response.status === 401) { _crumb = null; _cookie = null; }
        if (attempt < 3) await sleep(1000 * attempt);
        continue;
      }
      return await response.json();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Yahoo] Error: ${msg} (attempt ${attempt}/3)`);
      if (attempt < 3) await sleep(1000 * attempt);
    }
  }
  return null;
}

export class YahooProvider implements MarketDataProvider {
  readonly name = 'yahoo';

  async getOptionsData(ticker: string): Promise<OptionsSnapshot | null> {
    const url = `${YAHOO_BASE}/v7/finance/options/${ticker}`;
    const data = await yahooFetch(url) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const chain = (data as { optionChain?: { result?: unknown[] } })
        ?.optionChain?.result?.[0] as Record<string, unknown> | undefined;
      if (!chain) return null;

      const options = (chain.options as Record<string, unknown>[])?.[0];
      if (!options) return null;

      const calls = options.calls as Record<string, unknown>[] | undefined;
      const puts = options.puts as Record<string, unknown>[] | undefined;
      if (!calls || !puts) return null;

      let callVolume = 0, putVolume = 0;
      let callOI = 0, putOI = 0;
      let totalIV = 0, ivCount = 0;

      for (const c of calls) {
        callVolume += (c.volume as number) || 0;
        callOI += (c.openInterest as number) || 0;
        const iv = c.impliedVolatility as number | undefined;
        if (iv) { totalIV += iv; ivCount++; }
      }

      for (const p of puts) {
        putVolume += (p.volume as number) || 0;
        putOI += (p.openInterest as number) || 0;
        const iv = p.impliedVolatility as number | undefined;
        if (iv) { totalIV += iv; ivCount++; }
      }

      const putCallRatio = callOI > 0 ? putOI / callOI : 1;
      const avgIV = ivCount > 0 ? (totalIV / ivCount) * 100 : 0;
      // Implied move ≈ IV × sqrt(days to expiry / 365) — approximate with 7 days
      const impliedMove = avgIV * Math.sqrt(7 / 365);

      return {
        ticker,
        putCallRatio: Math.round(putCallRatio * 100) / 100,
        impliedVolatility: Math.round(avgIV * 100) / 100,
        impliedMove: Math.round(impliedMove * 100) / 100,
        callVolume,
        putVolume,
        callOpenInterest: callOI,
        putOpenInterest: putOI,
        timestamp: new Date().toISOString(),
      };
    } catch {
      console.error(`[Yahoo] Failed to parse options for ${ticker}`);
      return null;
    }
  }

  async getShortInterest(ticker: string): Promise<ShortInterest | null> {
    const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics`;
    const data = await yahooFetch(url) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const stats = (data as { quoteSummary?: { result?: Record<string, unknown>[] } })
        ?.quoteSummary?.result?.[0]?.defaultKeyStatistics as Record<string, unknown> | undefined;
      if (!stats) return null;

      const shortPercent = ((stats.shortPercentOfFloat as { raw?: number })?.raw ?? 0) * 100;
      const shortShares = (stats.sharesShort as { raw?: number })?.raw ?? 0;
      const daysToCover = (stats.shortRatio as { raw?: number })?.raw ?? 0;

      return {
        ticker,
        shortPercent: Math.round(shortPercent * 100) / 100,
        daysToCover: Math.round(daysToCover * 100) / 100,
        shortShares,
      };
    } catch {
      console.error(`[Yahoo] Failed to parse short interest for ${ticker}`);
      return null;
    }
  }

  async getEarningsHistory(ticker: string): Promise<EarningsHistory | null> {
    const url = `${YAHOO_BASE}/v10/finance/quoteSummary/${ticker}?modules=earningsHistory`;
    const data = await yahooFetch(url) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const history = (data as { quoteSummary?: { result?: Record<string, unknown>[] } })
        ?.quoteSummary?.result?.[0]?.earningsHistory as Record<string, unknown> | undefined;
      const quarters = (history?.history as Record<string, unknown>[]) ?? [];

      let beats = 0, misses = 0, inlines = 0;
      let totalSurprise = 0;
      let lastResult: 'beat' | 'miss' | 'inline' | null = null;

      for (const q of quarters) {
        const surprise = (q.surprisePercent as { raw?: number })?.raw ?? 0;
        totalSurprise += surprise;
        if (surprise > 2) beats++;
        else if (surprise < -2) misses++;
        else inlines++;
      }

      const total = quarters.length;
      if (total > 0) {
        const lastSurprise = (quarters[0]?.surprisePercent as { raw?: number })?.raw ?? 0;
        lastResult = lastSurprise > 2 ? 'beat' : lastSurprise < -2 ? 'miss' : 'inline';
      }

      return {
        ticker,
        totalQuarters: total,
        beats,
        misses,
        inlines,
        avgSurprise: total > 0 ? Math.round((totalSurprise / total) * 100) / 100 : 0,
        lastResult,
      };
    } catch {
      console.error(`[Yahoo] Failed to parse earnings history for ${ticker}`);
      return null;
    }
  }

  async getPrice(ticker: string): Promise<number | null> {
    const url = `${YAHOO_BASE}/v8/finance/chart/${ticker}?interval=1m&range=1d`;
    const data = await yahooFetch(url) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const result = (data as { chart?: { result?: Record<string, unknown>[] } })
        ?.chart?.result?.[0];
      const meta = result?.meta as Record<string, unknown> | undefined;
      return (meta?.regularMarketPrice as number) ?? null;
    } catch {
      return null;
    }
  }
}
