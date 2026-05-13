import type {
  MarketDataProvider,
  OptionsSnapshot,
  EarningsHistory,
  ShortInterest,
  Scenario,
  EVResult,
  PortfolioSimulation,
  DataQualityLabel,
} from './types.js';

/** Position definition */
export interface Position {
  ticker: string;
  shares: number;
  avgCost: number;
  stopLoss?: number;
  hasEarningsToday?: boolean;
}

/** EV Engine — calculates expected value for positions using market data */
export class EVEngine {
  constructor(private provider: MarketDataProvider) {}

  /** Calculate EV for a single position */
  async calculateEV(position: Position): Promise<EVResult> {
    const [price, options, earnings, shortInterest] = await Promise.all([
      this.provider.getPrice(position.ticker),
      this.provider.getOptionsData(position.ticker),
      this.provider.getEarningsHistory(position.ticker),
      this.provider.getShortInterest(position.ticker),
    ]);

    const currentPrice = price ?? position.avgCost;
    const positionValue = currentPrice * position.shares;

    const scenarios = this.buildScenarios(position, options, earnings, shortInterest);
    const expectedReturn = scenarios.reduce((sum, s) => sum + s.probability * s.returnPercent, 0);
    const expectedValue = positionValue * (expectedReturn / 100);

    const dataQuality = this.assessDataQuality(options, earnings, shortInterest);
    const confidence = this.assessConfidence(dataQuality);

    return {
      ticker: position.ticker,
      currentPrice,
      shares: position.shares,
      positionValue: Math.round(positionValue * 100) / 100,
      scenarios,
      expectedValue: Math.round(expectedValue * 100) / 100,
      expectedReturn: Math.round(expectedReturn * 100) / 100,
      confidence,
      dataQuality,
      timestamp: new Date().toISOString(),
    };
  }

  /** Build scenarios based on available data */
  private buildScenarios(
    position: Position,
    options: OptionsSnapshot | null,
    earnings: EarningsHistory | null,
    shortInterest: ShortInterest | null,
  ): Scenario[] {
    if (position.hasEarningsToday) {
      return this.buildEarningsScenarios(options, earnings, shortInterest);
    }
    return this.buildNormalScenarios(options, shortInterest);
  }

  /** Scenarios for earnings day */
  private buildEarningsScenarios(
    options: OptionsSnapshot | null,
    earnings: EarningsHistory | null,
    shortInterest: ShortInterest | null,
  ): Scenario[] {
    // Base probabilities from earnings history
    let beatProb = 0.55;
    let missProb = 0.30;
    let inlineProb = 0.15;

    if (earnings && earnings.totalQuarters > 0) {
      beatProb = earnings.beats / earnings.totalQuarters;
      missProb = earnings.misses / earnings.totalQuarters;
      inlineProb = earnings.inlines / earnings.totalQuarters;
      // Ensure they sum to 1
      const total = beatProb + missProb + inlineProb;
      if (total > 0) {
        beatProb /= total;
        missProb /= total;
        inlineProb /= total;
      }
    }

    // Adjust with options sentiment
    if (options) {
      const pcr = options.putCallRatio;
      if (pcr < 0.7) {
        // Strong bullish options → increase beat probability
        beatProb = Math.min(beatProb * 1.15, 0.85);
        missProb *= 0.85;
      } else if (pcr > 1.0) {
        // Bearish options → increase miss probability
        missProb = Math.min(missProb * 1.15, 0.65);
        beatProb *= 0.85;
      }
      // Re-normalize
      const total = beatProb + missProb + inlineProb;
      beatProb /= total;
      missProb /= total;
      inlineProb /= total;
    }

    // Estimate return magnitudes from implied move
    let beatReturn = 8;
    let missReturn = -12;
    let inlineReturn = 1;

    if (options && options.impliedMove > 0) {
      beatReturn = options.impliedMove * 0.7;   // Beat usually captures ~70% of implied
      missReturn = -options.impliedMove * 1.1;   // Miss overshoots ~110%
      inlineReturn = options.impliedMove * 0.1;  // Inline = small drift
    }

    // Short squeeze bonus on beat
    if (shortInterest && shortInterest.shortPercent > 15) {
      const squeezeBonus = Math.min(shortInterest.shortPercent / 10, 5);
      beatReturn += squeezeBonus;
    }

    return [
      {
        name: 'BEAT',
        probability: Math.round(beatProb * 100) / 100,
        returnPercent: Math.round(beatReturn * 100) / 100,
      },
      {
        name: 'MISS',
        probability: Math.round(missProb * 100) / 100,
        returnPercent: Math.round(missReturn * 100) / 100,
      },
      {
        name: 'INLINE',
        probability: Math.round(inlineProb * 100) / 100,
        returnPercent: Math.round(inlineReturn * 100) / 100,
      },
    ];
  }

  /** Scenarios for normal (non-earnings) days — 1 week horizon */
  private buildNormalScenarios(
    options: OptionsSnapshot | null,
    shortInterest: ShortInterest | null,
  ): Scenario[] {
    let bullProb = 0.40;
    let bearProb = 0.30;
    let flatProb = 0.30;

    if (options) {
      const pcr = options.putCallRatio;
      if (pcr < 0.7) {
        bullProb += 0.10;
        bearProb -= 0.10;
      } else if (pcr > 1.0) {
        bearProb += 0.10;
        bullProb -= 0.10;
      }
    }

    let bullReturn = 5;
    let bearReturn = -5;

    if (shortInterest && shortInterest.shortPercent > 15) {
      bullReturn += shortInterest.shortPercent / 10;
    }

    return [
      { name: 'BULLISH', probability: bullProb, returnPercent: bullReturn },
      { name: 'BEARISH', probability: bearProb, returnPercent: bearReturn },
      { name: 'FLAT', probability: flatProb, returnPercent: 0.5 },
    ];
  }

  /** Assess data quality */
  private assessDataQuality(
    options: OptionsSnapshot | null,
    earnings: EarningsHistory | null,
    shortInterest: ShortInterest | null,
  ): DataQualityLabel[] {
    const labels: DataQualityLabel[] = [];

    labels.push({
      field: 'options',
      source: options ? this.provider.name : 'none',
      label: options ? 'VERIFIED' : 'ESTIMATED',
    });

    labels.push({
      field: 'earnings_history',
      source: earnings ? this.provider.name : 'none',
      label: earnings && earnings.totalQuarters >= 4 ? 'VERIFIED' : 'SINGLE_SOURCE',
    });

    labels.push({
      field: 'short_interest',
      source: shortInterest ? this.provider.name : 'none',
      label: shortInterest ? 'SINGLE_SOURCE' : 'ESTIMATED',
    });

    return labels;
  }

  /** Assess overall confidence */
  private assessConfidence(labels: DataQualityLabel[]): 'HIGH' | 'MEDIUM' | 'LOW' {
    const verified = labels.filter((l) => l.label === 'VERIFIED').length;
    const estimated = labels.filter((l) => l.label === 'ESTIMATED').length;
    if (verified >= 2) return 'HIGH';
    if (estimated >= 2) return 'LOW';
    return 'MEDIUM';
  }

  /** Calculate portfolio-level simulation */
  async simulatePortfolio(positions: Position[], cashBalance: number): Promise<PortfolioSimulation> {
    const results: EVResult[] = [];

    for (const pos of positions) {
      const ev = await this.calculateEV(pos);
      results.push(ev);
      await new Promise((r) => setTimeout(r, 300)); // rate limit
    }

    const totalPositionValue = results.reduce((sum, r) => sum + r.positionValue, 0);
    const totalValue = totalPositionValue + cashBalance;

    // Portfolio-level scenarios
    const pessimistic = results.reduce((sum, r) => {
      const worstScenario = r.scenarios.reduce((min, s) => s.returnPercent < min ? s.returnPercent : min, 0);
      return sum + r.positionValue * (1 + worstScenario / 100);
    }, cashBalance);

    const optimistic = results.reduce((sum, r) => {
      const bestScenario = r.scenarios.reduce((max, s) => s.returnPercent > max ? s.returnPercent : max, 0);
      return sum + r.positionValue * (1 + bestScenario / 100);
    }, cashBalance);

    const base = results.reduce((sum, r) => {
      return sum + r.positionValue * (1 + r.expectedReturn / 100);
    }, cashBalance);

    const weightedEV = results.reduce((sum, r) => sum + r.expectedValue, 0);

    return {
      totalValue: Math.round(totalValue * 100) / 100,
      cashBalance,
      positions: results,
      scenarios: {
        pessimistic: {
          probability: 0.25,
          portfolioValue: Math.round(pessimistic * 100) / 100,
          returnPercent: Math.round(((pessimistic - totalValue) / totalValue) * 10000) / 100,
        },
        base: {
          probability: 0.50,
          portfolioValue: Math.round(base * 100) / 100,
          returnPercent: Math.round(((base - totalValue) / totalValue) * 10000) / 100,
        },
        optimistic: {
          probability: 0.25,
          portfolioValue: Math.round(optimistic * 100) / 100,
          returnPercent: Math.round(((optimistic - totalValue) / totalValue) * 10000) / 100,
        },
      },
      weightedEV: Math.round(weightedEV * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }
}
