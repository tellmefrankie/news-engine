import type { MarketDataProvider, OptionsSnapshot, ShortInterest, EarningsHistory } from '../types.js';

const API_BASE = 'https://api.polygon.io'; // polygon.io domain still supported

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MassiveProvider implements MarketDataProvider {
  readonly name = 'massive';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async apiFetch(path: string): Promise<unknown | null> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${API_BASE}${path}${separator}apiKey=${this.apiKey}`;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(url);
        if (response.status === 429) {
          console.error(`[Massive] Rate limited (attempt ${attempt}/3)`);
          if (attempt < 3) await sleep(2000 * attempt);
          continue;
        }
        if (!response.ok) {
          console.error(`[Massive] HTTP ${response.status} for ${path} (attempt ${attempt}/3)`);
          if (attempt < 3) await sleep(1000 * attempt);
          continue;
        }
        return await response.json();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[Massive] Error: ${msg} (attempt ${attempt}/3)`);
        if (attempt < 3) await sleep(1000 * attempt);
      }
    }
    return null;
  }

  async getOptionsData(ticker: string): Promise<OptionsSnapshot | null> {
    // Get options chain snapshot
    const data = await this.apiFetch(`/v3/snapshot/options/${ticker}?limit=250`) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const results = (data as { results?: Record<string, unknown>[] })?.results;
      if (!results || results.length === 0) return null;

      let callVolume = 0, putVolume = 0;
      let callOI = 0, putOI = 0;
      let totalIV = 0, ivCount = 0;

      for (const contract of results) {
        const details = contract.details as Record<string, unknown> | undefined;
        const greeks = contract.greeks as Record<string, unknown> | undefined;
        const dayData = contract.day as Record<string, unknown> | undefined;

        const contractType = details?.contract_type as string | undefined;
        const volume = (dayData?.volume as number) || 0;
        const oi = (contract.open_interest as number) || 0;
        const iv = (greeks?.delta !== undefined)
          ? (contract.implied_volatility as number) || 0
          : 0;

        if (contractType === 'call') {
          callVolume += volume;
          callOI += oi;
        } else if (contractType === 'put') {
          putVolume += volume;
          putOI += oi;
        }

        if (iv > 0) {
          totalIV += iv;
          ivCount++;
        }
      }

      const putCallRatio = callOI > 0 ? putOI / callOI : 1;
      const avgIV = ivCount > 0 ? (totalIV / ivCount) * 100 : 0;
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
    } catch (error) {
      console.error(`[Massive] Failed to parse options for ${ticker}:`, error);
      return null;
    }
  }

  async getShortInterest(ticker: string): Promise<ShortInterest | null> {
    // Polygon/Massive doesn't have direct short interest endpoint on starter plan
    // Fall back to ticker details for share data
    const data = await this.apiFetch(`/v3/reference/tickers/${ticker}?date=${this.getDateStr()}`) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const results = (data as { results?: Record<string, unknown> })?.results;
      if (!results) return null;

      const sharesOutstanding = (results.share_class_shares_outstanding as number) || 0;

      // Short interest not directly available — return partial data
      return {
        ticker,
        shortPercent: 0, // needs supplementary source
        daysToCover: 0,
        shortShares: 0,
      };
    } catch {
      return null;
    }
  }

  async getEarningsHistory(ticker: string): Promise<EarningsHistory | null> {
    // Not available on Massive/Polygon — use supplementary source
    return null;
  }

  async getPrice(ticker: string): Promise<number | null> {
    // Previous day close (snapshot)
    const data = await this.apiFetch(`/v2/aggs/ticker/${ticker}/prev`) as Record<string, unknown> | null;
    if (!data) return null;

    try {
      const results = (data as { results?: Record<string, unknown>[] })?.results;
      if (!results || results.length === 0) return null;
      return (results[0].c as number) ?? null; // close price
    } catch {
      return null;
    }
  }

  private getDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
