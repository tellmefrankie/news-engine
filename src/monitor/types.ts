/** Stock ticker to monitor */
export interface WatchItem {
  ticker: string;
  stopLoss: number;
  action: string; // e.g., "전량 매도", "50% 매도"
}

/** Price check result */
export interface PriceResult {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

/** Alert to send */
export interface PriceAlert {
  type: 'stop_loss' | 'entry' | 'significant_move';
  ticker: string;
  currentPrice: number;
  triggerPrice: number;
  action: string;
  message: string;
}

/** Monitor configuration */
export interface MonitorConfig {
  watchlist: WatchItem[];
  checkIntervalMs: number;
  telegramChatId: string;
}
