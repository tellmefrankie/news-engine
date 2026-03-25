import 'dotenv/config';
import cron from 'node-cron';
import { runPipeline } from './pipeline.js';
import { closeDb } from './db/index.js';
import type { PipelineOptions } from './types/index.js';

function parseArgs(args: string[]): { mode: 'scheduler' | 'immediate'; options: PipelineOptions } {
  const hasFlag = (flag: string): boolean => args.includes(flag);

  if (hasFlag('--now')) {
    return { mode: 'immediate', options: {} };
  }
  if (hasFlag('--collect-only')) {
    return { mode: 'immediate', options: { collectOnly: true } };
  }
  if (hasFlag('--analyze-only')) {
    return { mode: 'immediate', options: { analyzeOnly: true } };
  }
  if (hasFlag('--publish-only')) {
    return { mode: 'immediate', options: { publishOnly: true } };
  }

  return { mode: 'scheduler', options: {} };
}

async function runImmediate(options: PipelineOptions): Promise<void> {
  try {
    await runPipeline(options);
  } catch (error) {
    console.error('[Main] Pipeline failed:', error);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

function startScheduler(): void {
  const schedule = process.env.CRON_SCHEDULE || '0 6 * * *';

  if (!cron.validate(schedule)) {
    console.error(`[Scheduler] Invalid cron schedule: ${schedule}`);
    process.exit(1);
  }

  console.log(`[Scheduler] News Engine scheduler started`);
  console.log(`[Scheduler] Schedule: ${schedule} (KST)`);
  console.log(`[Scheduler] Waiting for next scheduled run...`);
  console.log(`[Scheduler] Use --now to run immediately`);

  cron.schedule(
    schedule,
    async () => {
      console.log(`[Scheduler] Cron triggered at ${new Date().toISOString()}`);
      try {
        await runPipeline();
      } catch (error) {
        console.error('[Scheduler] Pipeline execution failed:', error);
      }
    },
    {
      timezone: 'Asia/Seoul',
    },
  );

  // Graceful shutdown
  const shutdown = (): void => {
    console.log('[Scheduler] Shutting down...');
    closeDb();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function main(): void {
  console.log('[NewsEngine] ============================');
  console.log('[NewsEngine] AI Tech News Analysis Engine');
  console.log('[NewsEngine] ============================');

  const args = process.argv.slice(2);
  const { mode, options } = parseArgs(args);

  if (mode === 'immediate') {
    runImmediate(options);
  } else {
    startScheduler();
  }
}

main();
