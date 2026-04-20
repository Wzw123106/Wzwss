import fs from "node:fs/promises";
import path from "node:path";
import { buildRationalJudgement } from "../src/utils/judgementEngine.js";

const DEFAULT_SYMBOL = "518880.SS";

function mockSnapshot() {
  const open = 4.245;
  const close = 4.286;
  const high = 4.302;
  const low = 4.238;
  const changeAmount = Number((close - open).toFixed(3));
  const changeRate = Number((((close - open) / open) * 100).toFixed(2));

  return {
    symbol: DEFAULT_SYMBOL,
    date: new Date().toISOString().slice(0, 10),
    open,
    close,
    high,
    low,
    volume: 153620000,
    changeAmount,
    changeRate,
    source: "mock"
  };
}

async function fetchSnapshot() {
  const endpoint = process.env.ETF_API_URL;
  if (!endpoint) return mockSnapshot();

  const resp = await fetch(endpoint);
  if (!resp.ok) {
    throw new Error(`ETF_API_URL 请求失败: ${resp.status}`);
  }
  const data = await resp.json();

  return {
    symbol: data.symbol ?? DEFAULT_SYMBOL,
    date: data.date ?? new Date().toISOString().slice(0, 10),
    open: Number(data.open),
    close: Number(data.close),
    high: Number(data.high),
    low: Number(data.low),
    volume: Number(data.volume ?? 0),
    changeAmount: Number(data.changeAmount ?? (Number(data.close) - Number(data.open)).toFixed(3)),
    changeRate: Number(
      data.changeRate ??
        ((((Number(data.close) - Number(data.open)) / Number(data.open)) * 100).toFixed(2))
    ),
    source: "api"
  };
}

function renderReport(snapshot, judgement) {
  return `# 国泰黄金股ETF 每日报告 (${snapshot.date})

## 行情快照
- 代码: ${snapshot.symbol}
- 开盘: ${snapshot.open}
- 收盘: ${snapshot.close}
- 最高: ${snapshot.high}
- 最低: ${snapshot.low}
- 涨跌额: ${snapshot.changeAmount}
- 涨跌幅: ${snapshot.changeRate}%
- 成交量: ${snapshot.volume}
- 数据来源: ${snapshot.source}

## 理性判断
- 等级: ${judgement.level}
- 日内振幅: ${judgement.volatility}%

### 观察要点
${judgement.points.map((item) => `- ${item}`).join("\n")}

### 执行动作
${judgement.action}

---
> 仅供学习与策略复盘，不构成任何投资建议。
`;
}

async function main() {
  let snapshot;
  try {
    snapshot = await fetchSnapshot();
  } catch (error) {
    console.warn("获取在线数据失败，回退 mock 数据：", error.message);
    snapshot = mockSnapshot();
  }

  const judgement = buildRationalJudgement(snapshot);
  const markdown = renderReport(snapshot, judgement);

  const fileName = `${snapshot.date}.md`;
  const outputPath = path.join(process.cwd(), "reports", fileName);
  await fs.writeFile(outputPath, markdown, "utf-8");

  console.log(`日报已生成: ${outputPath}`);
}

main().catch((error) => {
  console.error("日报生成失败:", error);
  process.exit(1);
});
