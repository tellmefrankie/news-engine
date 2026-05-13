export interface OptionsTickerConfig {
  ticker: string;
  group: 'holdings' | 'watchlist' | 'sector_etf' | 'index';
}

export interface OptionsSnapshotRow {
  ticker: string;
  snapshot_date: string;
  price: number;
  put_call_ratio: number;
  avg_iv: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  implied_move: number;
  real_call_volume?: number;
  real_put_volume?: number;
  lottery_call_volume?: number;
  lottery_pct?: number;        // lottery volume / total call volume (0-100)
}

export interface ExpiryDetailRow {
  snapshot_id: number;
  expiry_date: string;
  days_to_expiry: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  avg_iv: number;
  put_call_ratio: number;
  real_call_volume: number;
  real_put_volume: number;
}

export interface OptionsAnomaly {
  ticker: string;
  type: 'pc_ratio_shift' | 'call_oi_surge' | 'iv_spike';
  current_value: number;
  previous_value: number;
  change_percent: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface SnapshotResult {
  ticker: string;
  success: boolean;
  error?: string;
}

export const OPTIONS_TICKERS: OptionsTickerConfig[] = [
  { ticker: 'TEM', group: 'holdings' },
  { ticker: 'RXRX', group: 'holdings' },
  { ticker: 'KTOS', group: 'holdings' },
  { ticker: 'IREN', group: 'holdings' },
  { ticker: 'CEG', group: 'holdings' },
  { ticker: 'MP', group: 'holdings' },
  { ticker: 'AMBA', group: 'watchlist' },
  { ticker: 'RIOT', group: 'watchlist' },
  { ticker: 'INCY', group: 'watchlist' },
  { ticker: 'XLK', group: 'sector_etf' },
  { ticker: 'XLV', group: 'sector_etf' },
  { ticker: 'XLI', group: 'sector_etf' },
  { ticker: 'XLE', group: 'sector_etf' },
  { ticker: 'XLB', group: 'sector_etf' },
  { ticker: 'SPY', group: 'index' },
  { ticker: 'QQQ', group: 'index' },
  { ticker: 'IWM', group: 'index' },
];
