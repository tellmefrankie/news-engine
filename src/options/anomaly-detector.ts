import type { OptionsAnomaly } from './types.js';
import { OPTIONS_TICKERS } from './types.js';
import { getSnapshot, getPreviousSnapshot } from './queries.js';
import { getDb } from '../db/index.js';

export function detectAnomalies(snapshotDate: string): OptionsAnomaly[] {
  const db = getDb();
  const anomalies: OptionsAnomaly[] = [];

  for (const { ticker } of OPTIONS_TICKERS) {
    const current = getSnapshot(db, ticker, snapshotDate);
    if (!current) continue;

    const previous = getPreviousSnapshot(db, ticker, snapshotDate);
    if (!previous) continue;

    anomalies.push(...detectTickerAnomalies(ticker, current, previous));
  }

  return anomalies;
}

function detectTickerAnomalies(
  ticker: string,
  current: { put_call_ratio: number; call_oi: number; avg_iv: number },
  previous: { put_call_ratio: number; call_oi: number; avg_iv: number },
): OptionsAnomaly[] {
  const anomalies: OptionsAnomaly[] = [];

  // 1. P/C ratio shift > ±0.3
  const pcChange = current.put_call_ratio - previous.put_call_ratio;
  if (Math.abs(pcChange) >= 0.3) {
    const severity = Math.abs(pcChange) >= 0.5 ? 'critical' : 'warning';
    const direction = pcChange > 0 ? '베어리시 전환' : '불리시 전환';
    anomalies.push({
      ticker,
      type: 'pc_ratio_shift',
      current_value: current.put_call_ratio,
      previous_value: previous.put_call_ratio,
      change_percent: Math.round(pcChange * 100) / 100,
      severity,
      message: `${ticker} P/C ${previous.put_call_ratio} → ${current.put_call_ratio} (${direction})`,
    });
  }

  // 2. Call OI surge > +30%
  if (previous.call_oi > 1000) {
    const oiChange = ((current.call_oi - previous.call_oi) / previous.call_oi) * 100;
    if (oiChange >= 30) {
      const severity = oiChange >= 50 ? 'critical' : 'warning';
      anomalies.push({
        ticker,
        type: 'call_oi_surge',
        current_value: current.call_oi,
        previous_value: previous.call_oi,
        change_percent: Math.round(oiChange * 100) / 100,
        severity,
        message: `${ticker} 콜 OI 급증 +${Math.round(oiChange)}% (${previous.call_oi.toLocaleString()} → ${current.call_oi.toLocaleString()})`,
      });
    }
  }

  // 3. IV spike > +20%
  if (previous.avg_iv > 10) {
    const ivChange = ((current.avg_iv - previous.avg_iv) / previous.avg_iv) * 100;
    if (ivChange >= 20) {
      const severity = ivChange >= 40 ? 'critical' : 'warning';
      anomalies.push({
        ticker,
        type: 'iv_spike',
        current_value: current.avg_iv,
        previous_value: previous.avg_iv,
        change_percent: Math.round(ivChange * 100) / 100,
        severity,
        message: `${ticker} IV 급등 +${Math.round(ivChange)}% (${previous.avg_iv}% → ${current.avg_iv}%)`,
      });
    }
  }

  return anomalies;
}
