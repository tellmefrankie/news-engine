import 'dotenv/config';
import { collectAllSnapshots } from './snapshot-collector.js';
import { detectAnomalies } from './anomaly-detector.js';
import { formatAnomalyAlerts, formatSentimentTable } from './formatter.js';
import { getLatestSnapshots } from './queries.js';
import { getDb } from '../db/index.js';

function getSnapshotDate(override?: string): string {
  if (override) return override;
  // Use US market date (ET). If before 4pm ET, use previous day.
  const now = new Date();
  const etOffset = -4 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const etMinutes = ((utcMinutes + etOffset) % 1440 + 1440) % 1440;
  const etHour = Math.floor(etMinutes / 60);

  const d = new Date(now);
  if (etHour < 16) d.setDate(d.getDate() - 1); // before market close, use yesterday
  // Skip weekends
  const day = d.getUTCDay();
  if (day === 0) d.setDate(d.getDate() - 2);
  if (day === 6) d.setDate(d.getDate() - 1);

  return d.toISOString().split('T')[0];
}

export async function runOptionsSnapshot(options: {
  date?: string;
  noAlerts?: boolean;
} = {}): Promise<void> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    console.error('[Options] POLYGON_API_KEY not set in .env');
    return;
  }

  const snapshotDate = getSnapshotDate(options.date);
  console.log(`[Options] ============================`);
  console.log(`[Options] Options Snapshot System`);
  console.log(`[Options] Date: ${snapshotDate}`);
  console.log(`[Options] ============================`);

  // Step 1: Collect
  console.log('[Options] Step 1: Collecting snapshots...');
  const results = await collectAllSnapshots(apiKey, snapshotDate);
  const success = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`[Options] Collected: ${success} success, ${failed} failed`);

  // Step 2: Detect anomalies
  if (!options.noAlerts) {
    console.log('[Options] Step 2: Detecting anomalies...');
    const anomalies = detectAnomalies(snapshotDate);
    if (anomalies.length > 0) {
      const alertMsg = formatAnomalyAlerts(anomalies);
      console.log(alertMsg);
      // TODO: Send to Telegram when bot token is configured
    } else {
      console.log('[Options] No anomalies detected');
    }
  }

  // Step 3: Print sentiment table
  console.log('[Options] Step 3: Generating sentiment table...');
  const db = getDb();
  const snapshots = getLatestSnapshots(db);
  const table = formatSentimentTable(snapshots);
  console.log(table);

  console.log('[Options] Done!');
}

// CLI
function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log('Usage: tsx src/options/index.ts [options]');
    console.log('  --date YYYY-MM-DD  Override snapshot date');
    console.log('  --no-alerts        Skip anomaly detection');
    console.log('  --sentiment        Show latest sentiment table only');
    return;
  }

  if (args.includes('--sentiment')) {
    const db = getDb();
    const snapshots = getLatestSnapshots(db);
    console.log(formatSentimentTable(snapshots));
    return;
  }

  const dateIdx = args.indexOf('--date');
  const date = dateIdx !== -1 ? args[dateIdx + 1] : undefined;
  const noAlerts = args.includes('--no-alerts');

  runOptionsSnapshot({ date, noAlerts }).catch(console.error);
}

main();
