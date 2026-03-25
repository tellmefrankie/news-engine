import { getDb, closeDb, getTodayBatchId } from './db/index.js';
import { collect } from './collector/index.js';
import { analyze } from './analyzer/index.js';
import { publish } from './publisher/index.js';
import { sendErrorAlert } from './publisher/telegram.js';
import type { PipelineOptions } from './types/index.js';

export async function runPipeline(options: PipelineOptions = {}): Promise<void> {
  const startTime = Date.now();
  const batchId = getTodayBatchId();

  console.log(`[Pipeline] ========================================`);
  console.log(`[Pipeline] Starting pipeline for batch: ${batchId}`);
  console.log(`[Pipeline] Options: ${JSON.stringify(options)}`);
  console.log(`[Pipeline] ========================================`);

  // Ensure DB is initialized
  getDb();

  try {
    // Step 1: Collect
    if (!options.analyzeOnly && !options.publishOnly) {
      console.log('[Pipeline] Step 1/3: Collecting news...');
      const collected = await collect(batchId);
      console.log(`[Pipeline] Collection done: ${collected} new articles`);
    } else {
      console.log('[Pipeline] Step 1/3: Skipped (analyze-only or publish-only mode)');
    }

    // Step 2: Analyze
    if (!options.collectOnly && !options.publishOnly) {
      console.log('[Pipeline] Step 2/3: Analyzing with Claude AI...');
      const analyzed = await analyze(batchId);
      console.log(`[Pipeline] Analysis done: ${analyzed} articles analyzed`);
    } else {
      console.log('[Pipeline] Step 2/3: Skipped (collect-only or publish-only mode)');
    }

    // Step 3: Publish
    if (!options.collectOnly && !options.analyzeOnly) {
      console.log('[Pipeline] Step 3/3: Publishing to Telegram...');
      const published = await publish(batchId);
      console.log(`[Pipeline] Publishing done: ${published} articles sent`);
    } else {
      console.log('[Pipeline] Step 3/3: Skipped (collect-only or analyze-only mode)');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Pipeline] ========================================`);
    console.log(`[Pipeline] Pipeline complete in ${elapsed}s`);
    console.log(`[Pipeline] ========================================`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Pipeline] FATAL ERROR: ${message}`);

    // Try to send error alert via Telegram
    try {
      await sendErrorAlert(`Pipeline failed for batch ${batchId}:\n${message}`);
    } catch (alertError) {
      console.error('[Pipeline] Could not send error alert:', alertError);
    }

    throw error;
  }
}
