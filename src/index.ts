import 'dotenv/config';
import { getDb, closeDb } from './db/index.js';

function main(): void {
  console.log('[NewsEngine] Starting...');

  // Initialize database
  const db = getDb();
  console.log('[NewsEngine] Database initialized');

  // Check for CLI flags
  const args = process.argv.slice(2);
  const hasFlag = (flag: string): boolean => args.includes(flag);

  if (hasFlag('--now') || hasFlag('--collect-only') || hasFlag('--analyze-only') || hasFlag('--publish-only')) {
    console.log('[NewsEngine] CLI mode detected. Pipeline will be available in Stage 5.');
  } else {
    console.log('[NewsEngine] Scheduler mode. Will be available in Stage 5.');
  }

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('[NewsEngine] Shutting down...');
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // In CLI mode, just verify DB and exit for now
  if (args.length > 0) {
    console.log('[NewsEngine] DB verification complete. Exiting.');
    closeDb();
  }
}

main();
