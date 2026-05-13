import { withHarness } from './harness.js';

/**
 * 에이전트 프롬프트 템플릿.
 * 모든 프롬프트는 withHarness()를 거쳐서 하네스가 자동 포함됨.
 */

export function macroPrompt(): string {
  return withHarness(`
You are Agent A (Macro). Research yesterday's US market close and current macro conditions.
Use WebSearch to find real data.

Research: S&P 500, Nasdaq, Dow close + % change, VIX, US 10Y yield, Oil (WTI), DXY, Fed news, economic data this week, Gold, Bitcoin.
For each data point include source name.
End with: BULLISH / BEARISH / NEUTRAL with 2-3 sentence reasoning.
  `.trim());
}

export function sectorPrompt(): string {
  return withHarness(`
You are Agent B (Sector). Research sector performance and rotation.
Use WebSearch.

Research all 11 S&P 500 sectors. Focus on themes relevant to portfolio:
AI Healthcare, Defense/Drones, Bitcoin Mining/Data Centers, Nuclear Energy, Edge AI/Robotics, Rare Earth/Materials.
End with: which sectors are in favor vs out of favor for next 1-2 weeks.
  `.trim());
}

export function newsPrompt(tickers: string[]): string {
  return withHarness(`
You are Agent D (News). Search for latest news and sentiment for each stock.
Use WebSearch for each ticker.

Tickers: ${tickers.join(', ')}

For each: latest news (48h), earnings, analyst changes, insider activity, short interest, sentiment.
Include source names. Do NOT make up data.
  `.trim());
}

export function scannerPrompt(tickers: string[]): string {
  return withHarness(`
You are Agent C (Technical Scanner). Analyze technicals for these stocks.
Use WebSearch. Find data from 2+ sources.

Tickers: ${tickers.join(', ')}

For each: current price, 52-week range, RSI, 20/50/200 SMA, MACD, support/resistance, volume vs average, short interest.
End each with: TECHNICALLY BULLISH / BEARISH / NEUTRAL.
  `.trim());
}

export function finderPrompt(exclude: string[]): string {
  return withHarness(`
You are Agent E (Finder). Find TOP 3 new swing trade opportunities.
Exclude: ${exclude.join(', ')}

Search broadly. For each: ticker, price, catalyst, entry/target/stop, expected return %, risk level.
Rank by expected value. Be specific with numbers.
  `.trim());
}

export function criticPrompt(signals: string): string {
  return withHarness(`
You are Agent F (Critic). Adversarially review these trading signals.
Search the web for counter-evidence. Be harsh and specific.

${signals}

For each signal: APPROVE / MODIFY / REJECT with reasoning.
Search for counter-evidence. Flag data conflicts.
  `.trim());
}

export function simulatorPrompt(portfolio: string): string {
  return withHarness(`
You are Agent G (Simulator). Run quantitative simulation.

${portfolio}

Generate 3 scenarios (pessimistic/base/optimistic) for 1-week and 1-month.
Use specific numbers. Calculate weighted expected value.
  `.trim());
}
