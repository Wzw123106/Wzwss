import { fetchAllQuotes as pullEastmoneyQuotes } from "../api/eastmoney.js";

const DEFAULT_POLL_MS = 2000;

export async function fetchAllQuotes(watchlist) {
  return pullEastmoneyQuotes(watchlist);
}

export function createQuotesPoller(callback, intervalMs = DEFAULT_POLL_MS, getWatchlist = null) {
  let timer = null;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const watchlist = typeof getWatchlist === "function" ? getWatchlist() : undefined;
      const data = await fetchAllQuotes(watchlist);
      callback(null, data);
    } catch (e) {
      callback(e, null);
    }
    if (!stopped) {
      timer = setTimeout(tick, intervalMs);
    }
  }

  return {
    start() {
      stopped = false;
      tick();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
    get intervalMs() {
      return intervalMs;
    }
  };
}
