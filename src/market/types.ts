// ===== Market Intelligence Types =====

/** Options data for a single ticker */
export interface OptionsSnapshot {
  ticker: string;
  putCallRatio: number;          // OI-based P/C ratio (< 0.7 bullish, > 1.0 bearish)
  impliedVolatility: number;     // Average near-ATM IV (annualized %)
  impliedMove: number;           // Expected move % for next expiry
  callVolume: number;
  putVolume: number;
  callOpenInterest: number;
  putOpenInterest: number;
  timestamp: string;
}

/** Earnings history for probability estimation */
export interface EarningsHistory {
  ticker: string;
  totalQuarters: number;
  beats: number;
  misses: number;
  inlines: number;
  avgSurprise: number;          // Average EPS surprise %
  lastResult: 'beat' | 'miss' | 'inline' | null;
}

/** Short interest data */
export interface ShortInterest {
  ticker: string;
  shortPercent: number;          // % of float
  daysToCover: number;
  shortShares: number;
}

/** Single scenario for EV calculation */
export interface Scenario {
  name: string;
  probability: number;           // 0-1
  returnPercent: number;         // Expected return in that scenario
}

/** EV calculation result for a position */
export interface EVResult {
  ticker: string;
  currentPrice: number;
  shares: number;
  positionValue: number;
  scenarios: Scenario[];
  expectedValue: number;         // Weighted sum (dollar amount)
  expectedReturn: number;        // Weighted sum (%)
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataQuality: DataQualityLabel[];
  timestamp: string;
}

/** Data quality label */
export interface DataQualityLabel {
  field: string;
  source: string;
  label: 'VERIFIED' | 'SINGLE_SOURCE' | 'ESTIMATED';
}

/** Portfolio-level simulation */
export interface PortfolioSimulation {
  totalValue: number;
  cashBalance: number;
  positions: EVResult[];
  scenarios: {
    pessimistic: { probability: number; portfolioValue: number; returnPercent: number };
    base: { probability: number; portfolioValue: number; returnPercent: number };
    optimistic: { probability: number; portfolioValue: number; returnPercent: number };
  };
  weightedEV: number;
  timestamp: string;
}

// ===== Data Provider Interface =====

/** Abstract interface for market data providers.
 *  Implement this to swap Yahoo → Benzinga → Polygon seamlessly. */
export interface MarketDataProvider {
  readonly name: string;

  /** Fetch options snapshot for a ticker */
  getOptionsData(ticker: string): Promise<OptionsSnapshot | null>;

  /** Fetch short interest data */
  getShortInterest(ticker: string): Promise<ShortInterest | null>;

  /** Fetch earnings history */
  getEarningsHistory(ticker: string): Promise<EarningsHistory | null>;

  /** Fetch current stock price */
  getPrice(ticker: string): Promise<number | null>;
}
