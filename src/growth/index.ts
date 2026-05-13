import 'dotenv/config';
import cron from 'node-cron';
import { runMonitor } from './reddit-monitor.js';
import { saveContent, generateContent } from './content-generator.js';
import { postTweetWithCTA } from './twitter-poster.js';
import { postLatestBlog } from './devto-poster.js';
import { checkPRs } from './pr-tracker.js';
import { checkGitHubStars } from './github-stars-monitor.js';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Growth Engine — 24/7 automated marketing pipeline
 *
 * Schedule (KST):
 * - Every 15 min:   Reddit/HN keyword monitoring → Telegram alerts
 * - Daily 15:00:    Auto-generate content + post tweet to X
 * - Weekly Mon 10:00: Auto-generate blog + post to dev.to
 * - Daily 18:00:    Daily growth report
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

// --- Activity Logger ---

let activityDb: Database.Database | null = null;

function getActivityDb(): Database.Database {
  if (!activityDb) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    activityDb = new Database(path.join(DATA_DIR, 'news.db'));
    activityDb.pragma('journal_mode = WAL');
    // Create team_activity table if not exists
    activityDb.exec(`
      CREATE TABLE IF NOT EXISTS team_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        team TEXT NOT NULL DEFAULT 'marketing',
        activity_type TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return activityDb;
}

function logActivity(
  activityType: string,
  description: string,
  metadata?: Record<string, unknown>,
  success = true
): void {
  try {
    const db = getActivityDb();
    db.prepare(`
      INSERT INTO team_activity (team, activity_type, description, metadata, success, created_at)
      VALUES ('marketing', ?, ?, ?, ?, datetime('now'))
    `).run(activityType, description, metadata ? JSON.stringify(metadata) : null, success ? 1 : 0);
  } catch (err) {
    console.error('[Growth] Failed to log activity:', err);
  }
}

// --- Pipeline Steps ---

async function runTweetPipeline(): Promise<void> {
  console.log('[Growth] Generating tweet content...');
  const content = await generateContent();

  if (!content || content.tweets.length === 0) {
    console.error('[Growth] No tweet content generated');
    logActivity('tweet', 'Content generation failed', {}, false);
    return;
  }

  // Pick the first unused tweet (rotate daily)
  const today = new Date().getDay();
  const tweet = content.tweets[today % content.tweets.length];

  console.log('[Growth] Posting tweet...');
  const success = await postTweetWithCTA(tweet);

  logActivity('tweet', success ? 'Tweet posted' : 'Tweet fallback (no credentials)', {
    tweet: tweet.substring(0, 100),
    success,
  }, success);
}

async function runBlogPipeline(): Promise<void> {
  console.log('[Growth] Generating blog content...');
  await saveContent();

  console.log('[Growth] Posting to dev.to...');
  const result = await postLatestBlog();

  logActivity('devto_post', result ? 'Blog posted to dev.to' : 'dev.to post fallback (no API key)', {
    articleUrl: result?.url,
    title: result?.title,
  }, !!result);
}

async function runMonitorPipeline(): Promise<void> {
  await runMonitor();
  logActivity('reddit_monitor', 'Reddit/HN scan completed');
}

// --- Main ---

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--monitor-once')) {
    runMonitorPipeline().catch(console.error);
    return;
  }

  if (args.includes('--check-prs')) {
    checkPRs().catch(console.error);
    return;
  }

  if (args.includes('--check-stars')) {
    checkGitHubStars().catch(console.error);
    return;
  }

  if (args.includes('--content')) {
    saveContent().catch(console.error);
    return;
  }

  if (args.includes('--tweet')) {
    runTweetPipeline().catch(console.error);
    return;
  }

  if (args.includes('--blog')) {
    runBlogPipeline().catch(console.error);
    return;
  }

  console.log('[Growth] ============================');
  console.log('[Growth] Growth Engine Started');
  console.log('[Growth] ============================');

  // Reddit/HN monitoring every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[Growth] Running Reddit/HN monitor...');
    runMonitorPipeline().catch(console.error);
  });

  // PR merge tracking every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[Growth] Checking awesome-claude-skills PRs...');
    checkPRs().catch(console.error);
  });

  // GitHub Stars monitoring every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('[Growth] Checking GitHub stars...');
    checkGitHubStars().catch(console.error);
  });

  // Content generation + tweet daily at 15:00 KST (06:00 UTC)
  cron.schedule('0 6 * * *', () => {
    console.log('[Growth] Running daily tweet pipeline...');
    runTweetPipeline().catch(console.error);
  });

  // Blog post to dev.to every Monday at 10:00 KST (01:00 UTC Monday)
  cron.schedule('0 1 * * 1', () => {
    console.log('[Growth] Running weekly blog pipeline...');
    runBlogPipeline().catch(console.error);
  });

  // Run initial monitor + PR check + GitHub stars
  runMonitorPipeline().catch(console.error);
  checkPRs().catch(console.error);
  checkGitHubStars().catch(console.error);

  console.log('[Growth] Schedules:');
  console.log('[Growth]   Reddit/HN monitor:   every 15 min');
  console.log('[Growth]   PR merge tracker:    every 15 min');
  console.log('[Growth]   GitHub Stars:        every 15 min');
  console.log('[Growth]   Tweet generation:    daily 15:00 KST');
  console.log('[Growth]   Blog → dev.to:       Monday 10:00 KST');
  console.log('[Growth] Waiting for next run...');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('[Growth] Shutting down...');
    if (activityDb) activityDb.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('[Growth] Shutting down...');
    if (activityDb) activityDb.close();
    process.exit(0);
  });
}

main();
