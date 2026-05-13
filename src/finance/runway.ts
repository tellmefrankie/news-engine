import {
  getFinanceDb,
  getRecentRecords,
  insertSnapshot,
  getLatestSnapshotRow,
  getSnapshotHistory,
  type FinancialRecord,
  type RunwaySnapshot,
} from './db.js';

export type RunwayStatus = 'GREEN' | 'YELLOW' | 'RED';

export type RunwayResult = {
  monthlyIncome: number;
  monthlyExpense: number;
  netMonthly: number;
  stockValueKrw: number | null;
  cashKrw: number | null;
  totalLiquid: number;
  runwayMonths: number;
  status: RunwayStatus;
};

export function calculateRunway(): RunwayResult {
  // Use recent 3-month records for averaging
  const records = getRecentRecords(3);

  // Separate by category
  const incomeRecords = records.filter((r) => r.category === 'income');
  const expenseRecords = records.filter((r) => r.category === 'expense');
  const assetRecords = records.filter((r) => r.category === 'asset');

  // Get distinct months in the data
  const months = new Set(records.map((r) => r.record_date.slice(0, 7)));
  const monthCount = Math.max(months.size, 1);

  // Sum income and expense
  const totalIncome = incomeRecords.reduce((sum, r) => sum + r.amount_krw, 0);
  const totalExpense = expenseRecords.reduce((sum, r) => sum + Math.abs(r.amount_krw), 0);

  const monthlyIncome = Math.round(totalIncome / monthCount);
  const monthlyExpense = Math.round(totalExpense / monthCount);
  const netMonthly = monthlyIncome - monthlyExpense;

  // Assets: use most recent value per source
  const latestAssets = new Map<string, number>();
  for (const r of assetRecords) {
    if (!latestAssets.has(r.source)) {
      latestAssets.set(r.source, r.amount_krw);
    }
  }

  const stockValueKrw = latestAssets.get('stock') ?? null;
  const cashKrw = latestAssets.get('cash') ?? null;
  const totalLiquid = (stockValueKrw ?? 0) + (cashKrw ?? 0);

  // Runway calculation:
  // If net is positive, runway is "infinite" (cap at 999)
  // Otherwise: totalLiquid / monthly_burn
  let runwayMonths: number;
  if (netMonthly >= 0) {
    runwayMonths = 999;
  } else {
    const monthlyBurn = Math.abs(netMonthly);
    runwayMonths = monthlyBurn > 0 ? totalLiquid / monthlyBurn : 999;
  }

  const status = getRunwayStatus(runwayMonths);

  return {
    monthlyIncome,
    monthlyExpense,
    netMonthly,
    stockValueKrw,
    cashKrw,
    totalLiquid,
    runwayMonths,
    status,
  };
}

export function getRunwayStatus(runwayMonths: number): RunwayStatus {
  if (runwayMonths >= 6) return 'GREEN';
  if (runwayMonths >= 3) return 'YELLOW';
  return 'RED';
}

export function createSnapshot(): RunwaySnapshot {
  const result = calculateRunway();
  const snapshot_date = new Date().toISOString().slice(0, 10);

  const id = insertSnapshot({
    snapshot_date,
    monthly_income: result.monthlyIncome,
    monthly_expense: result.monthlyExpense,
    stock_value_krw: result.stockValueKrw,
    cash_krw: result.cashKrw,
    runway_months: result.runwayMonths,
    status: result.status,
  });

  console.log(`[Finance:Runway] Snapshot saved (id=${id}, status=${result.status}, runway=${result.runwayMonths.toFixed(1)}개월)`);

  return {
    id,
    snapshot_date,
    monthly_income: result.monthlyIncome,
    monthly_expense: result.monthlyExpense,
    stock_value_krw: result.stockValueKrw,
    cash_krw: result.cashKrw,
    runway_months: result.runwayMonths,
    status: result.status,
    created_at: new Date().toISOString(),
  };
}

export function getLatestSnapshot(): RunwaySnapshot | null {
  return getLatestSnapshotRow();
}

export function getRunwayHistory(): RunwaySnapshot[] {
  return getSnapshotHistory(12);
}
