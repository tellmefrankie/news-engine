import type { OptionsAnomaly, OptionsSnapshotRow } from './types.js';

export function formatAnomalyAlerts(anomalies: OptionsAnomaly[]): string {
  if (anomalies.length === 0) return '';

  const lines: string[] = ['🔔 옵션 이상 감지!', ''];

  for (const a of anomalies) {
    const icon = a.severity === 'critical' ? '🚨' : '⚠️';
    lines.push(`${icon} ${a.message}`);
  }

  return lines.join('\n');
}

export function formatSentimentTable(snapshots: (OptionsSnapshotRow & { id: number })[]): string {
  const holdings = snapshots.filter((s) => ['TEM', 'RXRX', 'KTOS', 'IREN', 'CEG', 'MP'].includes(s.ticker));
  const watchlist = snapshots.filter((s) => ['AMBA', 'RIOT', 'INCY'].includes(s.ticker));
  const sectors = snapshots.filter((s) => ['XLK', 'XLV', 'XLI', 'XLE', 'XLB'].includes(s.ticker));
  const indices = snapshots.filter((s) => ['SPY', 'QQQ', 'IWM'].includes(s.ticker));

  const lines: string[] = ['📊 옵션 센티먼트 (Massive API)', ''];

  if (holdings.length > 0) {
    lines.push('보유:');
    for (const s of holdings) {
      const sentiment = getSentimentLabel(s.put_call_ratio);
      lines.push(`${s.ticker} $${s.price} | P/C ${s.put_call_ratio} ${sentiment} | IV ${s.avg_iv}%`);
    }
    lines.push('');
  }

  if (watchlist.length > 0) {
    lines.push('워치리스트:');
    for (const s of watchlist) {
      const sentiment = getSentimentLabel(s.put_call_ratio);
      lines.push(`${s.ticker} | P/C ${s.put_call_ratio} ${sentiment} | IV ${s.avg_iv}%`);
    }
    lines.push('');
  }

  if (sectors.length > 0) {
    lines.push('섹터:');
    for (const s of sectors) {
      const sentiment = getSentimentLabel(s.put_call_ratio);
      lines.push(`${s.ticker} | P/C ${s.put_call_ratio} ${sentiment}`);
    }
    lines.push('');
  }

  if (indices.length > 0) {
    lines.push('지수:');
    for (const s of indices) {
      const sentiment = getSentimentLabel(s.put_call_ratio);
      lines.push(`${s.ticker} | P/C ${s.put_call_ratio} ${sentiment}`);
    }
  }

  return lines.join('\n');
}

function getSentimentLabel(pcr: number): string {
  if (pcr < 0.5) return '🔥 극단 불리시';
  if (pcr < 0.7) return '✅ 불리시';
  if (pcr < 1.0) return '➡️ 중립-불리시';
  if (pcr < 1.3) return '⚠️ 약한 베어리시';
  return '🔴 베어리시';
}
