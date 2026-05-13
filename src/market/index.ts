import 'dotenv/config';
import { YahooProvider } from './providers/yahoo.js';
import { MassiveProvider } from './providers/massive.js';
import { EVEngine } from './ev-engine.js';
import type { Position, } from './ev-engine.js';
import type { EVResult, PortfolioSimulation, MarketDataProvider } from './types.js';

// ===== Provider Registry =====
const providers: Record<string, () => MarketDataProvider> = {
  yahoo: () => new YahooProvider(),
  massive: () => new MassiveProvider(process.env.POLYGON_API_KEY || ''),
  polygon: () => new MassiveProvider(process.env.POLYGON_API_KEY || ''),
};

function getProvider(): MarketDataProvider {
  const name = process.env.MARKET_DATA_PROVIDER || 'yahoo';
  const factory = providers[name];
  if (!factory) {
    console.error(`[Market] Unknown provider: ${name}. Falling back to yahoo.`);
    return new YahooProvider();
  }
  return factory();
}

// ===== Public API =====

/** Get EV for a single position */
export async function getPositionEV(position: Position): Promise<EVResult> {
  const engine = new EVEngine(getProvider());
  return engine.calculateEV(position);
}

/** Get full portfolio simulation */
export async function getPortfolioSimulation(
  positions: Position[],
  cashBalance: number,
): Promise<PortfolioSimulation> {
  const engine = new EVEngine(getProvider());
  return engine.simulatePortfolio(positions, cashBalance);
}

/** Format EV result for display */
export function formatEVResult(ev: EVResult): string {
  const lines: string[] = [];
  lines.push(`${ev.ticker} — $${ev.currentPrice} × ${ev.shares}주 = $${ev.positionValue}`);
  lines.push(`EV: ${ev.expectedReturn >= 0 ? '+' : ''}${ev.expectedReturn}% ($${ev.expectedValue})`);
  lines.push(`신뢰도: ${ev.confidence}`);

  for (const s of ev.scenarios) {
    const prob = Math.round(s.probability * 100);
    const ret = s.returnPercent >= 0 ? `+${s.returnPercent}%` : `${s.returnPercent}%`;
    lines.push(`  ${s.name}: ${prob}% 확률 × ${ret}`);
  }

  return lines.join('\n');
}

/** Format portfolio simulation for display */
export function formatSimulation(sim: PortfolioSimulation): string {
  const lines: string[] = [];
  lines.push(`포트폴리오: $${sim.totalValue} (현금 $${sim.cashBalance})`);
  lines.push('');

  for (const pos of sim.positions) {
    lines.push(formatEVResult(pos));
    lines.push('');
  }

  lines.push('--- 시나리오 ---');
  const { pessimistic, base, optimistic } = sim.scenarios;
  lines.push(`비관 (${pessimistic.probability * 100}%): $${pessimistic.portfolioValue} (${pessimistic.returnPercent}%)`);
  lines.push(`기본 (${base.probability * 100}%): $${base.portfolioValue} (${base.returnPercent}%)`);
  lines.push(`낙관 (${optimistic.probability * 100}%): $${optimistic.portfolioValue} (${optimistic.returnPercent}%)`);
  lines.push(`기대값: $${sim.weightedEV >= 0 ? '+' : ''}${sim.weightedEV}`);

  return lines.join('\n');
}

// ===== CLI Mode =====
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log('Usage: tsx src/market/index.ts [--ticker IREN] [--portfolio]');
    console.log('  --ticker TICKER  Calculate EV for a single ticker');
    console.log('  --portfolio      Run full portfolio simulation');
    console.log('  --provider NAME  Use specific provider (yahoo, benzinga, polygon)');
    return;
  }

  const tickerIdx = args.indexOf('--ticker');
  if (tickerIdx !== -1 && args[tickerIdx + 1]) {
    const ticker = args[tickerIdx + 1];
    console.log(`[Market] Calculating EV for ${ticker}...`);
    const ev = await getPositionEV({
      ticker,
      shares: 1,
      avgCost: 0,
      hasEarningsToday: args.includes('--earnings'),
    });
    console.log(formatEVResult(ev));
    return;
  }

  if (args.includes('--portfolio')) {
    // Default portfolio — update as needed
    const positions: Position[] = [
      { ticker: 'TEM', shares: 89, avgCost: 74.76 },
      { ticker: 'RXRX', shares: 877, avgCost: 3.39 },
      { ticker: 'KTOS', shares: 4, avgCost: 59.31 },
      { ticker: 'IREN', shares: 41, avgCost: 44.99, hasEarningsToday: true },
      { ticker: 'CEG', shares: 15, avgCost: 322.78 },
      { ticker: 'MP', shares: 40, avgCost: 68.0, hasEarningsToday: true },
    ];
    const cash = 8118;

    console.log('[Market] Running portfolio simulation...');
    const sim = await getPortfolioSimulation(positions, cash);
    console.log(formatSimulation(sim));
    return;
  }

  console.log('[Market] No arguments. Use --help for usage.');
}

main().catch(console.error);
