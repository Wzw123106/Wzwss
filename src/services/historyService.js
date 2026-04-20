import { fetchHistory as pullEastmoneyHistory } from "../api/eastmoney.js";

export async function fetchHistory({ id, kind, secid, days = 180 }) {
  return pullEastmoneyHistory({ id, kind, secid, days });
}
