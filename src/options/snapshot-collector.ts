import type { OptionsSnapshotRow, SnapshotResult } from './types.js';
import { OPTIONS_TICKERS } from './types.js';
import { getDb } from '../db/index.js';
import { insertSnapshot, insertExpiryDetails } from './queries.js';

const API_BASE = 'https://api.polygon.io';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ExpiryData {
  expiry_date: string;
  days_to_expiry: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  avg_iv: number;
  put_call_ratio: number;
  real_call_volume: number;
  real_put_volume: number;
}

export async function fetchOptionsChainWithExpiries(
  apiKey: string,
  ticker: string,
): Promise<{
  aggregate: {
    call_oi: number; put_oi: number;
    call_volume: number; put_volume: number;
    avg_iv: number; put_call_ratio: number;
    implied_move: number;
  };
  expiries: ExpiryData[];
  contracts: Array<{ type: string; price: number; volume: number }>;
  contractsByExpiry: Record<string, Array<{ type: string; price: number; volume: number }>>;
} | null> {
  const url = `${API_BASE}/v3/snapshot/options/${ticker}?limit=250&apiKey=${apiKey}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        console.error(`[OptionsCollector] ${ticker}: Rate limited (attempt ${attempt}/3)`);
        if (attempt < 3) await sleep(2000 * attempt);
        continue;
      }
      if (!response.ok) {
        console.error(`[OptionsCollector] ${ticker}: HTTP ${response.status} (attempt ${attempt}/3)`);
        if (attempt < 3) await sleep(1000 * attempt);
        continue;
      }

      const data = await response.json() as { results?: Record<string, unknown>[] };
      const results = data.results;
      if (!results || results.length === 0) return null;

      // Group by expiry
      const byExpiry: Record<string, { callOI: number; putOI: number; callVol: number; putVol: number; ivSum: number; ivCount: number; realCallVol: number; realPutVol: number }> = {};
      let totalCallOI = 0, totalPutOI = 0, totalCallVol = 0, totalPutVol = 0, totalIV = 0, ivCount = 0;

      // cheapThreshold is not known yet at this stage (no stock price), so we collect
      // per-contract price alongside volume and apply threshold after fetchPrice.
      // We store contracts with expiry for per-expiry real/lottery split.
      const contractsByExpiry: Record<string, Array<{ type: string; price: number; volume: number }>> = {};

      for (const contract of results) {
        const details = contract.details as Record<string, unknown> | undefined;
        const day = contract.day as Record<string, unknown> | undefined;
        const type = details?.contract_type as string | undefined;
        const expDate = details?.expiration_date as string | undefined;
        if (!type || !expDate) continue;

        const vol = (day?.volume as number) || 0;
        const oi = (contract.open_interest as number) || 0;
        // Polygon /v3/snapshot/options returns implied_volatility as a decimal (0.20 = 20%).
        // Guard against pre-multiplied values: if iv > 5 it's already a percentage, don't multiply again.
        const ivRaw = (contract.implied_volatility as number) || 0;
        const iv = ivRaw > 5 ? ivRaw / 100 : ivRaw;
        const optPrice = (day?.close as number) || 0;

        if (!byExpiry[expDate]) byExpiry[expDate] = { callOI: 0, putOI: 0, callVol: 0, putVol: 0, ivSum: 0, ivCount: 0, realCallVol: 0, realPutVol: 0 };
        if (!contractsByExpiry[expDate]) contractsByExpiry[expDate] = [];
        contractsByExpiry[expDate].push({ type, price: optPrice, volume: vol });

        if (type === 'call') {
          byExpiry[expDate].callOI += oi;
          byExpiry[expDate].callVol += vol;
          totalCallOI += oi;
          totalCallVol += vol;
        } else {
          byExpiry[expDate].putOI += oi;
          byExpiry[expDate].putVol += vol;
          totalPutOI += oi;
          totalPutVol += vol;
        }

        if (iv > 0) {
          byExpiry[expDate].ivSum += iv;
          byExpiry[expDate].ivCount++;
          totalIV += iv;
          ivCount++;
        }
      }

      const putCallRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;
      const avgIV = ivCount > 0 ? (totalIV / ivCount) * 100 : 0;
      const impliedMove = avgIV * Math.sqrt(7 / 365);

      const today = new Date();
      // sortedExpiries: real_call_volume / real_put_volume filled with 0 here;
      // collectTickerSnapshot applies per-expiry real/lottery split after fetching stock price.
      const sortedExpiries = Object.entries(byExpiry)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 3)
        .map(([date, d]): ExpiryData => {
          const expiryDate = new Date(date);
          const daysToExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          const expiryPCR = d.callOI > 0 ? d.putOI / d.callOI : 1;
          const expiryIV = d.ivCount > 0 ? (d.ivSum / d.ivCount) * 100 : 0;
          return {
            expiry_date: date,
            days_to_expiry: daysToExpiry,
            call_oi: d.callOI,
            put_oi: d.putOI,
            call_volume: d.callVol,
            put_volume: d.putVol,
            avg_iv: Math.round(expiryIV * 100) / 100,
            put_call_ratio: Math.round(expiryPCR * 100) / 100,
            real_call_volume: 0,
            real_put_volume: 0,
          };
        });

      // Collect per-contract data for real/lottery split
      const contracts: Array<{ type: string; price: number; volume: number }> = [];
      for (const contract of results) {
        const cType = (contract.details as Record<string, unknown>)?.contract_type as string | undefined;
        const cDay = contract.day as Record<string, unknown> | undefined;
        if (cType) {
          contracts.push({
            type: cType,
            price: (cDay?.close as number) || 0,
            volume: (cDay?.volume as number) || 0,
          });
        }
      }

      return {
        aggregate: {
          call_oi: totalCallOI,
          put_oi: totalPutOI,
          call_volume: totalCallVol,
          put_volume: totalPutVol,
          avg_iv: Math.round(avgIV * 100) / 100,
          put_call_ratio: Math.round(putCallRatio * 100) / 100,
          implied_move: Math.round(impliedMove * 100) / 100,
        },
        expiries: sortedExpiries,
        contracts,
        contractsByExpiry,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[OptionsCollector] ${ticker}: Error (attempt ${attempt}/3): ${msg}`);
      if (attempt < 3) await sleep(1000 * attempt);
    }
  }
  return null;
}

async function fetchPrice(apiKey: string, ticker: string): Promise<number> {
  try {
    const res = await fetch(`${API_BASE}/v2/aggs/ticker/${ticker}/prev?apiKey=${apiKey}`);
    if (!res.ok) return 0;
    const data = await res.json() as { results?: { c?: number }[] };
    return data.results?.[0]?.c ?? 0;
  } catch {
    return 0;
  }
}

export async function collectTickerSnapshot(
  apiKey: string,
  ticker: string,
  snapshotDate: string,
): Promise<{ snapshot: OptionsSnapshotRow; expiries: ExpiryData[] } | null> {
  const [chain, price] = await Promise.all([
    fetchOptionsChainWithExpiries(apiKey, ticker),
    fetchPrice(apiKey, ticker),
  ]);

  if (!chain) return null;

  // Real vs Lottery split: "real" = option price >= 5% of stock price
  const cheapThreshold = price * 0.05;
  let realCallVol = 0, realPutVol = 0, lotteryCallVol = 0;

  if (chain.contracts) {
    for (const c of chain.contracts) {
      const optPrice = c.price || 0;
      const vol = c.volume || 0;
      if (c.type === 'call') {
        if (optPrice >= cheapThreshold) realCallVol += vol;
        else lotteryCallVol += vol;
      } else {
        if (optPrice >= cheapThreshold) realPutVol += vol;
      }
    }
  }

  const totalCallVol = chain.aggregate.call_volume;
  const lotteryPct = totalCallVol > 0 ? Math.round((lotteryCallVol / totalCallVol) * 10000) / 100 : 0;

  // Per-expiry real/lottery split
  const expiriesWithReal = chain.expiries.map((e) => {
    const expiryContracts = chain.contractsByExpiry[e.expiry_date] ?? [];
    let eRealCall = 0, eRealPut = 0;
    for (const c of expiryContracts) {
      const optPrice = c.price || 0;
      const vol = c.volume || 0;
      if (optPrice >= cheapThreshold) {
        if (c.type === 'call') eRealCall += vol;
        else eRealPut += vol;
      }
    }
    return { ...e, real_call_volume: eRealCall, real_put_volume: eRealPut };
  });

  return {
    snapshot: {
      ticker,
      snapshot_date: snapshotDate,
      price,
      put_call_ratio: chain.aggregate.put_call_ratio,
      avg_iv: chain.aggregate.avg_iv,
      call_oi: chain.aggregate.call_oi,
      put_oi: chain.aggregate.put_oi,
      call_volume: chain.aggregate.call_volume,
      put_volume: chain.aggregate.put_volume,
      implied_move: chain.aggregate.implied_move,
      real_call_volume: realCallVol,
      real_put_volume: realPutVol,
      lottery_call_volume: lotteryCallVol,
      lottery_pct: lotteryPct,
    },
    expiries: expiriesWithReal,
  };
}

export async function collectAllSnapshots(
  apiKey: string,
  snapshotDate: string,
): Promise<SnapshotResult[]> {
  const db = getDb();
  const results: SnapshotResult[] = [];

  for (const { ticker } of OPTIONS_TICKERS) {
    console.log(`[OptionsCollector] Fetching ${ticker}...`);
    try {
      const data = await collectTickerSnapshot(apiKey, ticker, snapshotDate);
      if (!data) {
        results.push({ ticker, success: false, error: 'No data returned' });
        await sleep(500);
        continue;
      }

      const snapshotId = insertSnapshot(db, data.snapshot);
      if (data.expiries.length > 0) {
        insertExpiryDetails(db, data.expiries.map((e) => ({ ...e, snapshot_id: snapshotId })));
      }

      console.log(`[OptionsCollector] ${ticker}: P/C=${data.snapshot.put_call_ratio} IV=${data.snapshot.avg_iv}% ✅`);
      results.push({ ticker, success: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[OptionsCollector] ${ticker}: Failed — ${msg}`);
      results.push({ ticker, success: false, error: msg });
    }

    await sleep(500);
  }

  return results;
}
