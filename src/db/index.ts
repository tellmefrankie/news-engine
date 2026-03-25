import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createTables } from './schema.js';
import type { Article, ArticleRow, Analysis, AnalysisRow } from '../types/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'news.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createTables(db);
    console.log(`[DB] Connected to ${DB_PATH}`);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

/** Insert a collected article, ignoring duplicates by URL */
export function insertArticle(article: Article): number | null {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT OR IGNORE INTO articles (source, title, url, published_at, content_snippet, language, collected_at, batch_id)
    VALUES (@source, @title, @url, @published_at, @content_snippet, @language, @collected_at, @batch_id)
  `);
  const result = stmt.run(article);
  if (result.changes === 0) {
    return null; // duplicate
  }
  return Number(result.lastInsertRowid);
}

/** Get articles for a batch that haven't been analyzed yet */
export function getUnanalyzedArticles(batchId: string): ArticleRow[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT a.* FROM articles a
    LEFT JOIN analyses an ON a.id = an.article_id AND an.batch_id = @batchId
    WHERE a.batch_id = @batchId AND an.id IS NULL
    ORDER BY a.collected_at DESC
  `);
  return stmt.all({ batchId }) as ArticleRow[];
}

/** Get articles by their IDs */
export function getArticlesByIds(ids: number[]): ArticleRow[] {
  if (ids.length === 0) return [];
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const stmt = database.prepare(`SELECT * FROM articles WHERE id IN (${placeholders})`);
  return stmt.all(...ids) as ArticleRow[];
}

/** Insert an analysis result */
export function insertAnalysis(analysis: Omit<Analysis, 'id'>): number {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO analyses (article_id, batch_id, rank, summary_ko, industry_tags, sentiment, impact_score, commentary, analyzed_at, published_to_telegram)
    VALUES (@article_id, @batch_id, @rank, @summary_ko, @industry_tags, @sentiment, @impact_score, @commentary, @analyzed_at, @published_to_telegram)
  `);
  const result = stmt.run({
    ...analysis,
    industry_tags: JSON.stringify(analysis.industry_tags),
  });
  return Number(result.lastInsertRowid);
}

/** Get unpublished analyses for a batch */
export function getUnpublishedAnalyses(batchId: string): (AnalysisRow & ArticleRow)[] {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT an.*, a.title, a.url, a.source, a.language
    FROM analyses an
    JOIN articles a ON an.article_id = a.id
    WHERE an.batch_id = @batchId AND an.published_to_telegram = 0
    ORDER BY an.rank ASC
  `);
  return stmt.all({ batchId }) as (AnalysisRow & ArticleRow)[];
}

/** Mark analyses as published to Telegram */
export function markAsPublished(analysisIds: number[]): void {
  if (analysisIds.length === 0) return;
  const database = getDb();
  const placeholders = analysisIds.map(() => '?').join(',');
  const stmt = database.prepare(`UPDATE analyses SET published_to_telegram = 1 WHERE id IN (${placeholders})`);
  stmt.run(...analysisIds);
}

/** Get today's batch ID in YYYY-MM-DD format */
export function getTodayBatchId(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  return kst.toISOString().split('T')[0];
}
