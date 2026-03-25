import { getUnpublishedAnalyses, markAsPublished } from '../db/index.js';
import { buildTelegramMessage, sendToTelegram } from './telegram.js';

export async function publish(batchId: string): Promise<number> {
  const items = getUnpublishedAnalyses(batchId);

  if (items.length === 0) {
    console.log('[Publisher] No unpublished analyses found for this batch.');
    return 0;
  }

  console.log(`[Publisher] Found ${items.length} analyses to publish.`);

  // Build message
  const message = buildTelegramMessage(items);
  console.log(`[Publisher] Message built (${message.length} chars)`);

  // Send to Telegram
  await sendToTelegram(message);

  // Mark as published
  const ids = items.map((item) => item.id);
  markAsPublished(ids);
  console.log(`[Publisher] Marked ${ids.length} analyses as published.`);

  return items.length;
}
