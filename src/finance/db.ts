import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'news.db');

let db: Database.Database | null = null;

export function getFinanceDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createFinanceTables(db);
    console.log(`[Finance:DB] Connected to ${DB_PATH}`);
  }
  return db;
}

export function closeFinanceDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[Finance:DB] Connection closed');
  }
}

function createFinanceTables(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS financial_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_date TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL,
      amount_krw INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS runway_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      monthly_income INTEGER NOT NULL,
      monthly_expense INTEGER NOT NULL,
      stock_value_krw INTEGER,
      cash_krw INTEGER,
      runway_months REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed initial data if financial_records is empty
  const count = (database.prepare('SELECT COUNT(*) as cnt FROM financial_records').get() as { cnt: number }).cnt;
  if (count === 0) {
    const today = new Date().toISOString().slice(0, 7); // YYYY-MM
    const insert = database.prepare(`
      INSERT INTO financial_records (record_date, category, source, amount_krw, notes)
      VALUES (@record_date, @category, @source, @amount_krw, @notes)
    `);
    const seedMany = database.transaction(() => {
      insert.run({ record_date: today + '-01', category: 'income', source: 'salary', amount_krw: 2000000, notes: '월급' });
      insert.run({ record_date: today + '-01', category: 'expense', source: 'loan_interest', amount_krw: -210000, notes: '대출 이자' });
      insert.run({ record_date: today + '-01', category: 'expense', source: 'api_cost', amount_krw: -50000, notes: 'API 비용' });
      insert.run({ record_date: today + '-01', category: 'expense', source: 'infra', amount_krw: -20000, notes: '인프라 비용' });
      insert.run({ record_date: today + '-01', category: 'asset', source: 'stock', amount_krw: 43000000, notes: '주식 추정가' });
    });
    seedMany();
    console.log('[Finance:DB] Seed data inserted');
  }

  console.log('[Finance:DB] Tables created/verified');
}

export type FinancialRecord = {
  id: number;
  record_date: string;
  category: 'income' | 'expense' | 'asset';
  source: string;
  amount_krw: number;
  notes: string | null;
  created_at: string;
};

export type RunwaySnapshot = {
  id: number;
  snapshot_date: string;
  monthly_income: number;
  monthly_expense: number;
  stock_value_krw: number | null;
  cash_krw: number | null;
  runway_months: number;
  status: 'GREEN' | 'YELLOW' | 'RED';
  created_at: string;
};

export function insertRecord(
  category: 'income' | 'expense' | 'asset',
  source: string,
  amount_krw: number,
  notes?: string
): number {
  const database = getFinanceDb();
  const record_date = new Date().toISOString().slice(0, 10);
  const stmt = database.prepare(`
    INSERT INTO financial_records (record_date, category, source, amount_krw, notes)
    VALUES (@record_date, @category, @source, @amount_krw, @notes)
  `);
  const result = stmt.run({ record_date, category, source, amount_krw, notes: notes ?? null });
  return Number(result.lastInsertRowid);
}

export function getRecentRecords(months: number = 3): FinancialRecord[] {
  const database = getFinanceDb();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const stmt = database.prepare(`
    SELECT * FROM financial_records
    WHERE record_date >= @cutoff
    ORDER BY record_date DESC
  `);
  return stmt.all({ cutoff: cutoffStr }) as FinancialRecord[];
}

export function getAllRecords(): FinancialRecord[] {
  const database = getFinanceDb();
  const stmt = database.prepare('SELECT * FROM financial_records ORDER BY record_date DESC');
  return stmt.all() as FinancialRecord[];
}

export function insertSnapshot(snapshot: Omit<RunwaySnapshot, 'id' | 'created_at'>): number {
  const database = getFinanceDb();
  const stmt = database.prepare(`
    INSERT INTO runway_snapshots (snapshot_date, monthly_income, monthly_expense, stock_value_krw, cash_krw, runway_months, status)
    VALUES (@snapshot_date, @monthly_income, @monthly_expense, @stock_value_krw, @cash_krw, @runway_months, @status)
  `);
  const result = stmt.run(snapshot);
  return Number(result.lastInsertRowid);
}

export function getLatestSnapshotRow(): RunwaySnapshot | null {
  const database = getFinanceDb();
  const stmt = database.prepare(`
    SELECT * FROM runway_snapshots ORDER BY snapshot_date DESC, created_at DESC LIMIT 1
  `);
  return (stmt.get() as RunwaySnapshot | undefined) ?? null;
}

export function getSnapshotHistory(limit: number = 12): RunwaySnapshot[] {
  const database = getFinanceDb();
  const stmt = database.prepare(`
    SELECT * FROM runway_snapshots ORDER BY snapshot_date DESC, created_at DESC LIMIT @limit
  `);
  return stmt.all({ limit }) as RunwaySnapshot[];
}
