import { fetchListedSnapshot } from "../api/eastmoney.js";

const DEFAULT_SYMBOL = "518880.SS";

function toPercent(value) {
  return Number((value * 100).toFixed(2));
}

function buildMockData() {
  const mockClose = 4.286;
  const mockOpen = 4.245;
  const mockHigh = 4.302;
  const mockLow = 4.238;
  const change = mockClose - mockOpen;

  return {
    symbol: DEFAULT_SYMBOL,
    date: new Date().toISOString().slice(0, 10),
    open: mockOpen,
    close: mockClose,
    high: mockHigh,
    low: mockLow,
    volume: 153620000,
    changeAmount: Number(change.toFixed(3)),
    changeRate: toPercent(change / mockOpen),
    source: "mock"
  };
}

export async function fetchEtfSnapshot() {
  const secid = import.meta.env.VITE_ETF_SECID || "1.518880";

  try {
    const data = await fetchListedSnapshot(secid);

    return {
      symbol: data.symbol ?? DEFAULT_SYMBOL,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      open: data.open != null ? Number(data.open) : NaN,
      close: data.close != null ? Number(data.close) : NaN,
      high: data.high != null ? Number(data.high) : NaN,
      low: data.low != null ? Number(data.low) : NaN,
      volume: Number(data.volume ?? 0),
      changeAmount: Number(data.changeAmount ?? (Number(data.close) - Number(data.open)).toFixed(3)),
      changeRate: Number(
        data.changeRate ?? toPercent((Number(data.close) - Number(data.open)) / Number(data.open))
      ),
      source: data.source ?? "eastmoney"
    };
  } catch (error) {
    console.warn("读取在线ETF数据失败，已回退到本地模拟数据。", error);
    return buildMockData();
  }
}
