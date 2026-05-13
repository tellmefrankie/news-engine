import type Database from 'better-sqlite3';

export function createTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT,
      content_snippet TEXT,
      language TEXT DEFAULT 'en',
      collected_at TEXT NOT NULL,
      batch_id TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER NOT NULL REFERENCES articles(id),
      batch_id TEXT NOT NULL,
      rank INTEGER NOT NULL,
      summary_ko TEXT NOT NULL,
      industry_tags TEXT NOT NULL,
      sentiment TEXT NOT NULL,
      impact_score INTEGER NOT NULL,
      commentary TEXT NOT NULL,
      analyzed_at TEXT NOT NULL,
      published_to_telegram INTEGER DEFAULT 0
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_batch_id ON articles(batch_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_analyses_batch_id ON analyses(batch_id);
  `);

  // Options snapshot tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS options_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      price REAL NOT NULL,
      put_call_ratio REAL NOT NULL,
      avg_iv REAL NOT NULL,
      call_oi INTEGER NOT NULL,
      put_oi INTEGER NOT NULL,
      call_volume INTEGER NOT NULL,
      put_volume INTEGER NOT NULL,
      implied_move REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      real_call_volume INTEGER NOT NULL DEFAULT 0,
      real_put_volume INTEGER NOT NULL DEFAULT 0,
      lottery_call_volume INTEGER NOT NULL DEFAULT 0,
      lottery_pct REAL NOT NULL DEFAULT 0,
      UNIQUE(ticker, snapshot_date)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS options_expiry_detail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL REFERENCES options_snapshots(id) ON DELETE CASCADE,
      expiry_date TEXT NOT NULL,
      days_to_expiry INTEGER NOT NULL,
      call_oi INTEGER NOT NULL,
      put_oi INTEGER NOT NULL,
      call_volume INTEGER NOT NULL,
      put_volume INTEGER NOT NULL,
      avg_iv REAL NOT NULL,
      put_call_ratio REAL NOT NULL,
      real_call_volume INTEGER NOT NULL DEFAULT 0,
      real_put_volume INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrate existing tables: add real_call_volume / real_put_volume if not present
  const expiryColumns = db.prepare(`PRAGMA table_info(options_expiry_detail)`).all() as { name: string }[];
  const expiryColNames = expiryColumns.map((c) => c.name);
  if (!expiryColNames.includes('real_call_volume')) {
    db.exec(`ALTER TABLE options_expiry_detail ADD COLUMN real_call_volume INTEGER NOT NULL DEFAULT 0`);
  }
  if (!expiryColNames.includes('real_put_volume')) {
    db.exec(`ALTER TABLE options_expiry_detail ADD COLUMN real_put_volume INTEGER NOT NULL DEFAULT 0`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_options_snapshots_ticker ON options_snapshots(ticker);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_options_snapshots_date ON options_snapshots(snapshot_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_options_snapshots_ticker_date ON options_snapshots(ticker, snapshot_date);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_options_expiry_snapshot ON options_expiry_detail(snapshot_id);`);

  console.log('[DB] Tables created/verified successfully');
}
