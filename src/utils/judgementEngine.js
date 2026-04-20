function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getVolatility(snapshot) {
  const open = num(snapshot.open);
  const high = num(snapshot.high);
  const low = num(snapshot.low);

  // 场内有完整 OHLC 时，按经典日内振幅口径。
  if (open != null && open !== 0 && high != null && low != null) {
    return Number((((high - low) / open) * 100).toFixed(2));
  }

  // 场外估值无 OHLC 时，用盘中涨跌幅近似展示波动，避免长期显示 0%。
  const estimate = num(snapshot.changeRate);
  if (estimate != null) return Number(Math.abs(estimate).toFixed(2));

  // 若估值不可用，再用披露口径兜底。
  const official = num(snapshot.officialDayPct);
  if (official != null) return Number(Math.abs(official).toFixed(2));

  return 0;
}

/**
 * @param {object} snapshot
 * @param {number|null|undefined} snapshot.changeRate - 实时当日涨跌幅（优先：场外估值、场内盘口）
 * @param {number|null|undefined} snapshot.officialDayPct - 披露口径日涨跌幅（次选）
 * @param {number|null|undefined} snapshot.yearReturnPct - 近一年涨跌幅（提示高位）
 */
export function buildRationalJudgement(snapshot) {
  const official = num(snapshot.officialDayPct);
  const estimate = num(snapshot.changeRate);
  const yr = num(snapshot.yearReturnPct);

  const primary = estimate != null ? estimate : official != null ? official : 0;
  const abs = Math.abs(primary);
  const up = primary > 0;
  const down = primary < 0;

  const points = [];
  let level = "中性观察";
  let action = "";

  if (official != null && estimate != null && official !== 0 && estimate !== 0) {
    if (Math.sign(official) !== Math.sign(estimate)) {
      points.push("实时涨跌与披露口径方向不一致：盘中以实时为主，收盘后以披露为准复核。");
    }
  } else if (estimate == null && official != null) {
    points.push("当前无实时涨跌数据，暂以披露口径作为参考。");
  }

  if (abs < 0.3) {
    level = "窄幅震荡";
    points.push("涨跌幅度很小，多为常见噪音区间。");
    action = "维持既定定投与仓位纪律，无需因微小波动反复操作。";
  } else if (abs < 1.0) {
    level = up ? "温和上涨" : "温和回调";
    if (up) {
      points.push("温和上涨，宜对照月度计划，避免单笔冲动加仓。");
      action = "不追涨、不加杠杆；有计划的定投可按原节奏执行。";
    } else {
      points.push("温和回调，若无持仓逻辑变化，可观察两三个交易日再定。");
      action = "不恐慌割肉；逻辑未变时以观望或小步分批为宜，忌一次性重仓抄底。";
    }
  } else {
    level = up ? "偏强上涨" : "明显回撤";
    if (up) {
      points.push("单日涨幅偏大，短线情绪偏热，注意节奏与仓位。");
      const hi = yr != null && yr >= 50;
      if (hi) {
        points.push("近一年累计涨幅已较高，需提防情绪化追高。");
      }
      action = hi
        ? "近一年累计涨幅已高：避免追高，可等回调或坚持小额分批，勿单笔大幅加码。"
        : "若偏中长期配置，避免情绪化追高，等待回踩或按节奏定投。";
    } else {
      points.push("单日跌幅偏大，优先防止情绪化杀跌。");
      action = "若基本面判断未变，可采用小步分批而不是一次性重仓抄底。";
    }
  }

  const volatility = getVolatility(snapshot);

  if (snapshot.open != null && snapshot.high != null && snapshot.low != null) {
    if (volatility >= 2.5) {
      points.push("日内振幅较高，建议控制仓位并分批决策。");
    } else {
      points.push("日内振幅相对可控，可结合中期计划执行。");
    }
  } else {
    points.push("场外或无完整盘口时，盘中涨跌为估值推断，重点仍应看仓位纪律与收盘披露的复核结果。");
  }

  if (snapshot.volume != null && snapshot.volume > 180000000) {
    points.push("成交量活跃，多空分歧与参与度较高。");
  } else if (snapshot.volume != null) {
    points.push("成交量一般，信号宜结合后续几日确认。");
  } else {
    points.push("无成交量数据时，更依赖中长期逻辑与定投纪律。");
  }

  return {
    level,
    volatility,
    points,
    action
  };
}
