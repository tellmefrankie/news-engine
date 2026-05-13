import { execSync } from 'child_process';

/**
 * X/Twitter automation via AppleScript + Chrome.
 * Uses CEO's logged-in Chrome session.
 * Chrome must be open.
 */

function runAppleScript(script: string): void {
  execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 30000 });
}

export async function postTweet(text: string): Promise<boolean> {
  try {
    console.log('[X-Auto] Opening compose...');
    runAppleScript(`
      tell application "Google Chrome"
        activate
        delay 1
        set URL of active tab of front window to "https://x.com/compose/post"
        delay 8
      end tell
      tell application "System Events"
        tell process "Google Chrome"
          set frontmost to true
          delay 2
          keystroke "${text.replace(/"/g, '\\"').replace(/\n/g, '" & return & "')}"
          delay 2
          keystroke return using command down
          delay 3
        end tell
      end tell
    `);
    console.log('[X-Auto] Tweet posted!');
    return true;
  } catch (e) {
    console.error('[X-Auto] Failed:', e);
    return false;
  }
}

/**
 * CEO RULE: X comments must not contain Gumroad paid links, pricing, or "buy" CTAs.
 * Allowed: GitHub link, Agensi free skill link, technical value only.
 */
const REPLY_BLOCKED_PATTERNS = [
  /https?:\/\/[^\s]*gumroad[^\s]*/gi,
  /\$29\b/g,
  /\bbuy (now|this|it)\b/gi,
  /\bpurchase\b/gi,
];

function enforceReplyPolicy(text: string): string {
  // CEO final rule: no links of any kind in replies
  let safe = text;
  safe = safe.replace(/https?:\/\/[^\s]+/gi, '');
  safe = safe.replace(/\$29\b/g, '');
  safe = safe.replace(/\bbuy (now|this|it)\b/gi, 'try it');
  safe = safe.replace(/\bpurchase\b/gi, 'check out');
  safe = safe.replace(/  +/g, ' ');
  return safe.trim();
}

/** Policy-enforced reply — strips paid links before posting. Use this for all comments. */
export async function replyToTweetSafe(tweetUrl: string, replyText: string): Promise<boolean> {
  const safe = enforceReplyPolicy(replyText);
  if (safe !== replyText) {
    console.log('[X-Auto] Reply policy applied. Original stripped of paid links/pricing.');
  }
  return replyToTweet(tweetUrl, safe);
}

export async function replyToTweet(tweetUrl: string, replyText: string): Promise<boolean> {
  try {
    console.log(`[X-Auto] Replying to ${tweetUrl}...`);
    runAppleScript(`
      tell application "Google Chrome"
        activate
        delay 1
        set URL of active tab of front window to "${tweetUrl}"
        delay 8
      end tell
      tell application "System Events"
        tell process "Google Chrome"
          set frontmost to true
          delay 2
          -- Click reply area
          click at {640, 600}
          delay 2
          keystroke "${replyText.replace(/"/g, '\\"').replace(/\n/g, '" & return & "')}"
          delay 2
          keystroke return using command down
          delay 3
        end tell
      end tell
    `);
    console.log('[X-Auto] Reply posted!');
    return true;
  } catch (e) {
    console.error('[X-Auto] Reply failed:', e);
    return false;
  }
}

// CLI
const args = process.argv.slice(2);
if (args[0] === '--tweet') {
  const text = args.slice(1).join(' ') || 'Test tweet from CodeFoundry';
  postTweet(text);
} else if (args[0] === '--reply') {
  const url = args[1];
  const text = args.slice(2).join(' ');
  // Always use policy-enforced reply (no Gumroad/pricing in comments)
  if (url && text) replyToTweetSafe(url, text);
  else console.log('Usage: --reply <tweet-url> <text>');
}
