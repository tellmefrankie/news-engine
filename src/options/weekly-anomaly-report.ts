/**
 * Weekly Options Anomaly Report Generator
 * Runs every Monday: extracts top 3 signals from options_snapshots DB
 * Output: markdown draft ready for dev.to / Substack
 */
import { getDb } from '../db/index.js';

interface TickerWeekly {
  ticker: string;
  dates: string[];
  pcrs: number[];
  lottery_pcts: number[];
  avg_pcr: number;
  max_pcr: number;
  lottery_trend: 'rising' | 'falling' | 'stable';
}

function detectAnomalies(rows: TickerWeekly[]): TickerWeekly[] {
  return rows
    .filter(r => r.dates.length >= 3) // need at least 3 days
    .map(r => {
      const last = r.lottery_pcts[r.lottery_pcts.length - 1];
      const first = r.lottery_pcts[0];
      const trend: 'rising' | 'falling' | 'stable' = last - first > 20 ? 'rising' : last - first < -20 ? 'falling' : 'stable';
      return { ...r, lottery_trend: trend };
    })
    .sort((a, b) => {
      // Score: high PCR or rapidly rising lottery pct
      const scoreA = a.max_pcr * 10 + (a.lottery_trend === 'rising' ? 20 : 0);
      const scoreB = b.max_pcr * 10 + (b.lottery_trend === 'rising' ? 20 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 5);
}

export function generateWeeklyReport(): string {
  const db = getDb();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().split('T')[0];

  const rows = db.prepare(`
    SELECT ticker, snapshot_date, put_call_ratio, lottery_pct
    FROM options_snapshots
    WHERE snapshot_date >= ?
    ORDER BY ticker, snapshot_date ASC
  `).all(cutoff) as Array<{ ticker: string; snapshot_date: string; put_call_ratio: number; lottery_pct: number }>;

  // Group by ticker
  const byTicker: Record<string, TickerWeekly> = {};
  for (const row of rows) {
    if (!byTicker[row.ticker]) {
      byTicker[row.ticker] = { ticker: row.ticker, dates: [], pcrs: [], lottery_pcts: [], avg_pcr: 0, max_pcr: 0, lottery_trend: 'stable' };
    }
    byTicker[row.ticker].dates.push(row.snapshot_date);
    byTicker[row.ticker].pcrs.push(row.put_call_ratio);
    byTicker[row.ticker].lottery_pcts.push(row.lottery_pct);
  }

  for (const t of Object.values(byTicker)) {
    t.avg_pcr = t.pcrs.reduce((a, b) => a + b, 0) / t.pcrs.length;
    t.max_pcr = Math.max(...t.pcrs);
  }

  const anomalies = detectAnomalies(Object.values(byTicker));
  const today = new Date().toISOString().split('T')[0];

  let md = `# This Week in Options Anomalies — ${today}\n\n`;
  md += `*Top signals from the live scanner. Data: ${cutoff} → ${today}.*\n\n---\n\n`;

  anomalies.slice(0, 3).forEach((t, i) => {
    const tableRows = t.dates.map((d, j) =>
      `${d}  ${t.pcrs[j].toFixed(2).padStart(5)}   ${t.lottery_pcts[j].toFixed(0).padStart(4)}%`
    ).join('\n');

    const signal = t.max_pcr > 3 ? '⚠ EXTREME HEDGE' :
                   t.max_pcr > 1.5 ? '⚠ Defensive' :
                   t.lottery_trend === 'rising' ? '⚠ Lottery surge' : '~ Neutral';

    md += `## Signal ${i + 1}: ${t.ticker} — ${signal}\n\n`;
    md += '```\n';
    md += `Date        PCR    Lottery%\n`;
    md += `----------  -----  --------\n`;
    md += tableRows + '\n';
    md += '```\n\n';
    md += `*Avg PCR: ${t.avg_pcr.toFixed(2)} | Max: ${t.max_pcr.toFixed(2)} | Lottery trend: ${t.lottery_trend}*\n\n`;
    md += `**Interpretation:** [ALPHA to fill]\n\n---\n\n`;
  });

  md += `## How I Build This\n\n`;
  md += `Scanner: [github.com/tellmefrankie/ai-investment-skills](https://github.com/tellmefrankie/ai-investment-skills)\n\n`;
  md += `Full stack with Telegram alerts: [$29 Pro Bundle](https://jaehyunpark.gumroad.com/l/tcyahy)\n\n`;
  md += `*Not financial advice.*\n`;

  return md;
}

// Run directly
const report = generateWeeklyReport();
console.log(report);
