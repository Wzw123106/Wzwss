/**
 * 东方财富 / 天天基金公开接口（与原先 Node 服务逻辑一致）。
 * 浏览器受 CORS 限制，开发/预览依赖 vite.config 中 /__em-* 代理；纯静态部署需在网关做同等反向代理，
 * 或设置 VITE_EM_PUSH2_BASE 等环境变量指向你的代理前缀。
 */
import { WATCHLIST } from "../config/watchlist.js";

const EM = {
  push2: import.meta.env.VITE_EM_PUSH2_BASE ?? "/__em-push2",
  push2his: import.meta.env.VITE_EM_PUSH2HIS_BASE ?? "/__em-push2his",
  fundgz: import.meta.env.VITE_EM_FUNDGZ_BASE ?? "/__em-fundgz",
  fund: import.meta.env.VITE_EM_FUND_BASE ?? "/__em-fund"
};

const cache = new Map();

function cacheGet(key, maxAgeMs) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > maxAgeMs) return null;
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
}

function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateInShanghai(timestampMs) {
  const d = new Date(Number(timestampMs));
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

function parseFundJsonp(text) {
  const m = text.match(/jsonpgz\(([\s\S]*)\)\s*;?\s*$/);
  if (!m || !m[1].trim()) throw new Error("基金估值返回为空");
  return JSON.parse(m[1]);
}

function pickDays(points, days) {
  if (!Array.isArray(points)) return [];
  if (!Number.isFinite(days) || days <= 0) return points;
  return points.slice(Math.max(0, points.length - days));
}

function parseKlineCsvLines(klines) {
  if (!Array.isArray(klines)) return [];
  return klines
    .map((line) => {
      const p = String(line).split(",");
      const date = p[0];
      const open = parseNumber(p[1]);
      const close = parseNumber(p[2]);
      const high = parseNumber(p[3]);
      const low = parseNumber(p[4]);
      const volume = parseNumber(p[5]) ?? 0;
      if (!date || open == null || close == null || high == null || low == null) return null;
      return { date, open, high, low, close, volume };
    })
    .filter(Boolean);
}

function synthesizeCandlesFromNavPoints(points) {
  if (!Array.isArray(points) || !points.length) return [];
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const close = points[i].value;
    const open = i > 0 ? points[i - 1].value : close;
    const high = Math.max(open, close);
    const low = Math.min(open, close);
    out.push({
      date: points[i].date,
      open,
      high,
      low,
      close,
      volume: 0
    });
  }
  return out;
}

/** 按最新净值日回溯约 365 天锚点，口径接近「近1年」；不足则取最早可查点并带说明 */
function computeYearReturnFromNavPoints(points) {
  if (!points?.length || points.length < 2) return { pct: null, note: "" };
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const end = sorted[sorted.length - 1];
  if (end.value == null || !Number.isFinite(end.value)) return { pct: null, note: "" };
  const endMs = Date.parse(end.date);
  if (!Number.isFinite(endMs)) return { pct: null, note: "" };
  const cutoffMs = endMs - 365 * 86400000;
  let anchor = null;
  for (const p of sorted) {
    const t = Date.parse(p.date);
    if (t <= cutoffMs) anchor = p;
    else break;
  }
  if (!anchor) anchor = sorted[0];
  if (anchor.date === end.date) return { pct: null, note: "" };
  if (anchor.value == null || !Number.isFinite(anchor.value) || anchor.value === 0) return { pct: null, note: "" };
  const pct = ((end.value - anchor.value) / anchor.value) * 100;
  const spanDays = (endMs - Date.parse(anchor.date)) / 86400000;
  const note = spanDays < 340 ? "区间不足1年" : "";
  return { pct: Number(pct.toFixed(2)), note };
}

/** 披露净值：最近一期相对上一期的涨跌幅（与支付宝「日涨跌幅」口径接近） */
function computeOtcOfficialDailyPct(points) {
  if (!points?.length || points.length < 2) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const end = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  if (prev.value == null || !Number.isFinite(prev.value) || prev.value === 0) return null;
  if (end.value == null || !Number.isFinite(end.value)) return null;
  return Number((((end.value - prev.value) / prev.value) * 100).toFixed(2));
}

function computeYearReturnFromCandles(candles) {
  if (!candles?.length || candles.length < 2) return { pct: null, note: "" };
  const sorted = [...candles].sort((a, b) => a.date.localeCompare(b.date));
  const end = sorted[sorted.length - 1];
  if (end.close == null || !Number.isFinite(end.close)) return { pct: null, note: "" };
  const endMs = Date.parse(end.date);
  if (!Number.isFinite(endMs)) return { pct: null, note: "" };
  const cutoffMs = endMs - 365 * 86400000;
  let anchor = null;
  for (const c of sorted) {
    if (Date.parse(c.date) <= cutoffMs) anchor = c;
    else break;
  }
  if (!anchor) anchor = sorted[0];
  if (anchor.date === end.date) return { pct: null, note: "" };
  if (anchor.close == null || !Number.isFinite(anchor.close) || anchor.close === 0) return { pct: null, note: "" };
  const pct = ((end.close - anchor.close) / anchor.close) * 100;
  const spanDays = (endMs - Date.parse(anchor.date)) / 86400000;
  const note = spanDays < 340 ? "区间不足1年" : "";
  return { pct: Number(pct.toFixed(2)), note };
}

async function fetchOtcNavPointsFull(fundCode) {
  const cacheKey = `otc:navfull:${fundCode}`;
  const cached = cacheGet(cacheKey, 45 * 60 * 1000);
  if (cached) return cached;

  const url = `${EM.fund}/pingzhongdata/${fundCode}.js`;
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`pingzhongdata 请求失败: ${resp.status}`);
  const text = await resp.text();

  const m = text.match(/var\s+Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) throw new Error("未找到 Data_netWorthTrend");

  const raw = JSON.parse(m[1]);
  const points = raw
    .map((x) => {
      const t = Number(x.x);
      const v = Number(x.y);
      if (!Number.isFinite(t) || !Number.isFinite(v)) return null;
      // 使用上海时区日期，避免 toISOString() 带来的 UTC 跨日偏移。
      const date = formatDateInShanghai(t);
      if (!date) return null;
      return { date, value: v };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));

  cacheSet(cacheKey, points);
  return points;
}

async function loadListedAllCandles(secid) {
  const cacheKey = `listed:klall:${secid}`;
  const cached = cacheGet(cacheKey, 2 * 60 * 1000);
  if (cached) return cached;

  const url = `${EM.push2his}/api/qt/stock/kline/get`;
  const params = new URLSearchParams({
    secid,
    klt: "101",
    fqt: "1",
    beg: "0",
    end: "20500101",
    fields1: "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
    fields2: "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
    rtntype: "6"
  });
  const resp = await fetch(`${url}?${params.toString()}`, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) throw new Error(`K线请求失败: ${resp.status}`);
  const json = await resp.json();
  const kl = json?.data?.klines;
  if (!Array.isArray(kl) || !kl.length) throw new Error("K线数据为空");

  const allCandles = parseKlineCsvLines(kl);
  cacheSet(cacheKey, allCandles);
  return allCandles;
}

async function getOtcNavDerivedMetrics(fundCode) {
  try {
    const points = await fetchOtcNavPointsFull(fundCode);
    return {
      yearReturn: computeYearReturnFromNavPoints(points),
      officialDayPct: computeOtcOfficialDailyPct(points)
    };
  } catch {
    return {
      yearReturn: { pct: null, note: "" },
      officialDayPct: null
    };
  }
}

/** 场内：接口涨跌幅或现价相对昨收 */
function listedOfficialDayPct(snap) {
  const r = parseNumber(snap.changeRate);
  if (r != null) return Number(r.toFixed(2));
  const c = parseNumber(snap.close);
  const p = parseNumber(snap.prevClose);
  if (c != null && p != null && p !== 0) {
    return Number((((c - p) / p) * 100).toFixed(2));
  }
  return null;
}

async function getListedYearReturn(secid) {
  try {
    const all = await loadListedAllCandles(secid);
    return computeYearReturnFromCandles(all);
  } catch {
    return { pct: null, note: "" };
  }
}

async function fetchFundEstimate(fundCode) {
  const url = `${EM.fundgz}/js/${fundCode}.js`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: "https://fund.eastmoney.com/" }
  });
  if (!resp.ok) throw new Error(`天天基金请求失败: ${resp.status}`);
  const text = await resp.text();
  const d = parseFundJsonp(text);
  const dwjz = parseNumber(d.dwjz);
  const gsz = parseNumber(d.gsz);
  const gszzl = parseNumber(d.gszzl);
  if (dwjz == null && gsz == null) {
    throw new Error("基金估值无净值数据");
  }
  const close = gsz ?? dwjz;
  const prevClose = dwjz;
  let changeAmount = null;
  // 对齐养基宝「数据源1」口径：优先并严格使用 fundgz 返回的 gszzl。
  // gszzl 缺失时不再用 gsz/dwjz 反推，避免与第三方估值模型产生额外偏差。
  let changeRate = gszzl;
  if (prevClose != null && close != null) {
    changeAmount = Number((close - prevClose).toFixed(4));
  }

  return {
    id: fundCode,
    kind: "otc",
    symbol: `${fundCode}.OF`,
    name: d.name ?? "",
    date: d.jzrq ?? "",
    estimateTime: d.gztime ?? "",
    open: null,
    high: null,
    low: null,
    close,
    prevClose,
    volume: null,
    amount: null,
    changeAmount,
    changeRate,
    source: "fund123"
  };
}

async function fetchOtcHistoryCandles(fundCode, days = 180) {
  const cacheKey = `otc:candles:${fundCode}:${days}`;
  const cached = cacheGet(cacheKey, 10 * 60 * 1000);
  if (cached) return cached;

  const points = await fetchOtcNavPointsFull(fundCode);
  const trimmedPoints = pickDays(points, days);
  const candles = synthesizeCandlesFromNavPoints(trimmedPoints);
  const payload = {
    id: fundCode,
    kind: "otc",
    seriesName: "单位净值",
    chartType: "candlestick",
    synthetic: true,
    candles,
    points: trimmedPoints
  };
  cacheSet(cacheKey, payload);
  return payload;
}

export async function fetchListedSnapshot(secid) {
  const base = `${EM.push2}/api/qt/stock/get`;
  const params = new URLSearchParams({
    ut: "fa5fd1943c7b386f172d6893dbfba10b",
    invt: "2",
    fltt: "2",
    secid,
    fields: ["f57", "f58", "f43", "f44", "f45", "f46", "f47", "f48", "f60", "f169", "f170"].join(",")
  });

  const url = `${base}?${params.toString()}`;
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!resp.ok) throw new Error(`Eastmoney 请求失败: ${resp.status}`);
  const json = await resp.json();
  if (!json?.data) throw new Error("Eastmoney 返回无 data");

  const d = json.data;
  const open = parseNumber(d.f46);
  const close = parseNumber(d.f43);
  const high = parseNumber(d.f44);
  const low = parseNumber(d.f45);
  const volume = parseNumber(d.f47);
  const amount = parseNumber(d.f48);
  const changeAmount = parseNumber(d.f169);
  const changeRate = parseNumber(d.f170);
  const code = d.f57 || "";
  const market = secid.startsWith("1.") ? "SH" : "SZ";

  return {
    id: code,
    kind: "listed",
    symbol: `${code}.${market}`,
    name: d.f58 ?? "",
    date: new Date().toISOString().slice(0, 10),
    estimateTime: "",
    open,
    close,
    high,
    low,
    volume,
    amount,
    prevClose: parseNumber(d.f60),
    changeAmount,
    changeRate,
    source: "eastmoney"
  };
}

async function fetchListedHistoryCandles(secid, days = 180) {
  const cacheKey = `listed:candles:${secid}:${days}`;
  const cached = cacheGet(cacheKey, 2 * 60 * 1000);
  if (cached) return cached;

  const allCandles = await loadListedAllCandles(secid);
  const candles = pickDays(allCandles, days);
  const points = candles.map((c) => ({ date: c.date, value: c.close }));
  const payload = {
    secid,
    kind: "listed",
    seriesName: "日K",
    chartType: "candlestick",
    synthetic: false,
    candles,
    points
  };
  cacheSet(cacheKey, payload);
  return payload;
}

function attachYearReturn(base, yr) {
  return {
    ...base,
    yearReturnPct: yr.pct,
    yearReturnNote: yr.note || ""
  };
}

async function fetchOneEntry(entry) {
  const label = entry.name || entry.id;
  try {
    if (entry.kind === "listed") {
      const secid = entry.secid;
      if (!secid) throw new Error("缺少 secid");
      const [data, yr] = await Promise.all([fetchListedSnapshot(secid), getListedYearReturn(secid)]);
      return {
        ok: true,
        label,
        ...attachYearReturn(data, yr),
        officialDayPct: listedOfficialDayPct(data)
      };
    }
    const code = entry.id;
    try {
      const [data, navMeta] = await Promise.all([fetchFundEstimate(code), getOtcNavDerivedMetrics(code)]);
      return {
        ok: true,
        label,
        ...data,
        name: entry.name || data.name,
        yearReturnPct: navMeta.yearReturn.pct,
        yearReturnNote: navMeta.yearReturn.note || "",
        officialDayPct: navMeta.officialDayPct
      };
    } catch (e) {
      if (entry.fallbackSecid) {
        const [snap, yr] = await Promise.all([
          fetchListedSnapshot(entry.fallbackSecid),
          getListedYearReturn(entry.fallbackSecid)
        ]);
        return {
          ok: true,
          label,
          id: entry.id,
          kind: "listed",
          symbol: snap.symbol,
          name: entry.name || snap.name,
          date: snap.date,
          estimateTime: "",
          quoteNote: `场内 ${snap.symbol} 实时（同标的 LOF 主份额，C 类无估值时回退）`,
          open: snap.open,
          high: snap.high,
          low: snap.low,
          close: snap.close,
          volume: snap.volume,
          amount: snap.amount,
          prevClose: snap.prevClose,
          changeAmount: snap.changeAmount,
          changeRate: snap.changeRate,
          source: snap.source,
          yearReturnPct: yr.pct,
          yearReturnNote: yr.note || "",
          officialDayPct: listedOfficialDayPct(snap)
        };
      }
      throw e;
    }
  } catch (error) {
    return {
      ok: false,
      label,
      id: entry.id,
      kind: entry.kind,
      error: error?.message || String(error)
    };
  }
}

export async function fetchAllQuotes(watchlist = WATCHLIST) {
  const list = Array.isArray(watchlist) && watchlist.length ? watchlist : WATCHLIST;
  const items = await Promise.all(list.map((e) => fetchOneEntry(e)));
  return {
    updatedAt: new Date().toISOString(),
    items
  };
}

export async function fetchHistory({ id, kind, secid, days = 180 }) {
  if (kind === "listed") {
    if (!secid) throw new Error("listed 缺少 secid");
    const data = await fetchListedHistoryCandles(secid, days);
    return { ok: true, ...data, id };
  }
  if (!id) throw new Error("otc 缺少 id");
  const data = await fetchOtcHistoryCandles(id, days);
  return { ok: true, ...data };
}
