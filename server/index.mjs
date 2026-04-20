import http from "node:http";
import { URL } from "node:url";
import { WATCHLIST } from "../src/config/watchlist.js";

const PORT = Number(process.env.PORT || 5174);
const DEFAULT_SECID = process.env.ETF_SECID || "1.518880";

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

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(body);
}

function parseNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

/** 东方财富日K CSV：日期,开,收,高,低,量,... */
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

/** 场外仅每日净值：用「昨净值→今净值」合成 OHLC（非交易所真实K线） */
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

async function fetchFundEstimate(fundCode) {
  const url = `https://fundgz.1234567.com.cn/js/${fundCode}.js`;
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
  let changeRate = gszzl;
  if (prevClose != null && close != null) {
    changeAmount = Number((close - prevClose).toFixed(4));
  }
  if (changeRate == null && prevClose && close != null) {
    changeRate = Number((((close - prevClose) / prevClose) * 100).toFixed(2));
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

  const url = `http://fund.eastmoney.com/pingzhongdata/${fundCode}.js`;
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
      const date = new Date(t).toISOString().slice(0, 10);
      return { date, value: v };
    })
    .filter(Boolean);

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

async function fetchEastmoneySnapshot(secid) {
  const base = "https://push2.eastmoney.com/api/qt/stock/get";
  const params = new URLSearchParams({
    ut: "fa5fd1943c7b386f172d6893dbfba10b",
    invt: "2",
    fltt: "2",
    secid,
    fields: [
      "f57",
      "f58",
      "f43",
      "f44",
      "f45",
      "f46",
      "f47",
      "f48",
      "f60",
      "f169",
      "f170"
    ].join(",")
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

  const url = "https://push2his.eastmoney.com/api/qt/stock/kline/get";
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

async function fetchOneEntry(entry) {
  const label = entry.name || entry.id;
  try {
    if (entry.kind === "listed") {
      const secid = entry.secid;
      if (!secid) throw new Error("缺少 secid");
      const data = await fetchEastmoneySnapshot(secid);
      return { ok: true, label, ...data };
    }
    const code = entry.id;
    try {
      const data = await fetchFundEstimate(code);
      return { ok: true, label, ...data, name: entry.name || data.name };
    } catch (e) {
      if (entry.fallbackSecid) {
        const snap = await fetchEastmoneySnapshot(entry.fallbackSecid);
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
          source: snap.source
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

async function fetchAllQuotes() {
  const items = await Promise.all(WATCHLIST.map((e) => fetchOneEntry(e)));
  return {
    updatedAt: new Date().toISOString(),
    items
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return sendJson(res, 400, { error: "Bad Request" });
    if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/etf/today") {
      const secid = url.searchParams.get("secid") || DEFAULT_SECID;
      const data = await fetchEastmoneySnapshot(secid);
      return sendJson(res, 200, data);
    }

    if (req.method === "GET" && url.pathname === "/api/watchlist") {
      return sendJson(res, 200, { list: WATCHLIST });
    }

    if (req.method === "GET" && url.pathname === "/api/quotes/all") {
      const payload = await fetchAllQuotes();
      return sendJson(res, 200, payload);
    }

    if (req.method === "GET" && url.pathname === "/api/history") {
      const id = url.searchParams.get("id") || "";
      const kind = url.searchParams.get("kind") || "otc";
      const secid = url.searchParams.get("secid") || "";
      const days = Number(url.searchParams.get("days") || 180);

      if (kind === "listed") {
        if (!secid) return sendJson(res, 400, { error: "listed 缺少 secid" });
        const data = await fetchListedHistoryCandles(secid, days);
        return sendJson(res, 200, { ok: true, ...data, id });
      }

      if (!id) return sendJson(res, 400, { error: "otc 缺少 id" });
      const data = await fetchOtcHistoryCandles(id, days);
      return sendJson(res, 200, { ok: true, ...data });
    }

    return sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || "Server Error" });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ETF API server running: http://127.0.0.1:${PORT}`);
  console.log(`Watchlist: GET http://127.0.0.1:${PORT}/api/quotes/all`);
});
