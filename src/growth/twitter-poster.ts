import 'dotenv/config';
import { createHmac, randomBytes } from 'node:crypto';

/**
 * Twitter/X Auto-Poster
 * Posts generated tweets via X API v2.
 * Cost: ~$0.015/tweet on Basic tier.
 * Falls back to console output if credentials not set.
 */

const GUMROAD_LINK = 'https://jaehyunpark.gumroad.com/l/tcyahy';

interface TwitterCredentials {
  bearerToken: string;
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function getCredentials(): TwitterCredentials | null {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!bearerToken || !apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    return null;
  }
  return { bearerToken, apiKey, apiSecret, accessToken, accessTokenSecret };
}

/**
 * Generate OAuth 1.0a Authorization header for user context requests (tweet creation).
 * X API v2 tweet creation requires OAuth 1.0a user context, not bearer token.
 */
function buildOAuthHeader(
  method: string,
  url: string,
  creds: TwitterCredentials,
  bodyParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: Math.random().toString(36).substring(2) + Date.now().toString(36),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  // Combine all params for signature base
  const allParams = { ...oauthParams, ...bodyParams };
  const sortedParams = Object.entries(allParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessTokenSecret)}`;

  // Use Node.js crypto for HMAC-SHA256
  const signature = createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');

  oauthParams['oauth_signature'] = signature;

  const authHeader = 'OAuth ' + Object.entries(oauthParams)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  return authHeader;
}

export async function postTweet(text: string): Promise<boolean> {
  const creds = getCredentials();

  if (!creds) {
    console.log('[Twitter] Credentials not configured. Tweet that would be posted:');
    console.log('---');
    console.log(text);
    console.log('---');
    return false;
  }

  const url = 'https://api.twitter.com/2/tweets';
  const body = JSON.stringify({ text });

  const authHeader = buildOAuthHeader('POST', url, creds);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Twitter] Failed to post tweet (${res.status}):`, err);
      return false;
    }

    const data = await res.json() as { data?: { id: string; text: string } };
    console.log(`[Twitter] Tweet posted: https://twitter.com/i/web/status/${data.data?.id}`);
    return true;
  } catch (error) {
    console.error('[Twitter] Request failed:', error);
    return false;
  }
}

/**
 * Post a tweet from a pre-generated file or inline text.
 * Ensures CTA with Gumroad link is appended if not present.
 */
export async function postTweetWithCTA(text: string): Promise<boolean> {
  const maxLen = 280;
  const cta = ` ${GUMROAD_LINK}`;

  let finalText = text;
  if (!finalText.includes(GUMROAD_LINK)) {
    // Only append CTA if it fits
    if ((finalText + cta).length <= maxLen) {
      finalText = finalText + cta;
    }
  }

  if (finalText.length > maxLen) {
    finalText = finalText.substring(0, maxLen - 3) + '...';
  }

  return postTweet(finalText);
}

// CLI: npx tsx src/growth/twitter-poster.ts "tweet text"
if (import.meta.url === `file://${process.argv[1]}`) {
  const text = process.argv[2];
  if (!text) {
    console.error('Usage: tsx src/growth/twitter-poster.ts "tweet text"');
    process.exit(1);
  }
  postTweetWithCTA(text).then(ok => process.exit(ok ? 0 : 1)).catch(console.error);
}
