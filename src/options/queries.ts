import type Database from 'better-sqlite3';
import type { OptionsSnapshotRow, ExpiryDetailRow } from './types.js';
import type { OptionsSnapshot } from '../market/types.js';

export function insertSnapshot(db: Database.Database, row: OptionsSnapshotRow): number {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO options_snapshots
    (ticker, snapshot_date, price, put_call_ratio, avg_iv, call_oi, put_oi, call_volume, put_volume, implied_move, real_call_volume, real_put_volume, lottery_call_volume, lottery_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    row.ticker, row.snapshot_date, row.price, row.put_call_ratio,
    row.avg_iv, row.call_oi, row.put_oi, row.call_volume, row.put_volume, row.implied_move,
    row.real_call_volume ?? 0, row.real_put_volume ?? 0, row.lottery_call_volume ?? 0, row.lottery_pct ?? 0,
  );
  return result.lastInsertRowid as number;
}

export function insertExpiryDetails(db: Database.Database, rows: ExpiryDetailRow[]): void {
  const stmt = db.prepare(`
    INSERT INTO options_expiry_detail
    (snapshot_id, expiry_date, days_to_expiry, call_oi, put_oi, call_volume, put_volume, avg_iv, put_call_ratio, real_call_volume, real_put_volume)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = db.transaction((items: ExpiryDetailRow[]) => {
    for (const r of items) {
      stmt.run(r.snapshot_id, r.expiry_date, r.days_to_expiry, r.call_oi, r.put_oi, r.call_volume, r.put_volume, r.avg_iv, r.put_call_ratio, r.real_call_volume, r.real_put_volume);
    }
  });
  insertMany(rows);
}

export function getSnapshot(
  db: Database.Database, ticker: string, date: string,
): (OptionsSnapshotRow & { id: number }) | null {
  return db.prepare('SELECT * FROM options_snapshots WHERE ticker = ? AND snapshot_date = ?')
    .get(ticker, date) as (OptionsSnapshotRow & { id: number }) | undefined ?? null;
}

export function getPreviousSnapshot(
  db: Database.Database, ticker: string, beforeDate: string,
): (OptionsSnapshotRow & { id: number }) | null {
  return db.prepare('SELECT * FROM options_snapshots WHERE ticker = ? AND snapshot_date < ? ORDER BY snapshot_date DESC LIMIT 1')
    .get(ticker, beforeDate) as (OptionsSnapshotRow & { id: number }) | undefined ?? null;
}

export function getSnapshotRange(
  db: Database.Database, ticker: string, startDate: string, endDate: string,
): (OptionsSnapshotRow & { id: number })[] {
  return db.prepare('SELECT * FROM options_snapshots WHERE ticker = ? AND snapshot_date BETWEEN ? AND ? ORDER BY snapshot_date')
    .all(ticker, startDate, endDate) as (OptionsSnapshotRow & { id: number })[];
}

export function getExpiryDetails(db: Database.Database, snapshotId: number): ExpiryDetailRow[] {
  return db.prepare('SELECT * FROM options_expiry_detail WHERE snapshot_id = ? ORDER BY expiry_date')
    .all(snapshotId) as ExpiryDetailRow[];
}

export function getLatestSnapshots(db: Database.Database): (OptionsSnapshotRow & { id: number })[] {
  return db.prepare(`
    SELECT s.* FROM options_snapshots s
    INNER JOIN (SELECT ticker, MAX(snapshot_date) as max_date FROM options_snapshots GROUP BY ticker) latest
    ON s.ticker = latest.ticker AND s.snapshot_date = latest.max_date
    ORDER BY s.ticker
  `).all() as (OptionsSnapshotRow & { id: number })[];
}

export function getSnapshotAsOptionsData(
  db: Database.Database, ticker: string,
): OptionsSnapshot | null {
  const row = db.prepare('SELECT * FROM options_snapshots WHERE ticker = ? ORDER BY snapshot_date DESC LIMIT 1')
    .get(ticker) as (OptionsSnapshotRow & { id: number }) | undefined;
  if (!row) return null;
  return {
    ticker: row.ticker,
    putCallRatio: row.put_call_ratio,
    impliedVolatility: row.avg_iv,
    impliedMove: row.implied_move,
    callVolume: row.call_volume,
    putVolume: row.put_volume,
    callOpenInterest: row.call_oi,
    putOpenInterest: row.put_oi,
    timestamp: row.snapshot_date,
  };
}
