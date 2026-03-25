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

  console.log('[DB] Tables created/verified successfully');
}
