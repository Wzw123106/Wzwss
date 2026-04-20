# 自选基金监控（Vue）

- 默认监控 **10 只自选基金**（见 `src/config/watchlist.js`），数据由本地 `yarn server` 聚合。
- **场外基金**：天天基金 `fundgz` 盘中估值（准实时刷新）。
- **场内品种**：东方财富 `push2` 盘口快照。
- 页面默认 **每 2 秒** 拉取一次（可用 `VITE_POLL_MS` 调整）。
- 点击表格一行可查看「理性判断」辅助复盘（非投资建议）。

## 1. 安装与启动

```bash
yarn install
yarn dev
```

`yarn dev`（或 `cnpm run dev`）会自动同时启动：

- 本地 API：`node ./server/index.mjs`（5174）
- 前端 Vite：`vite`（默认 5173）

如果你只想单独起前端，可以用：

```bash
yarn dev:web
```

如果你遇到端口占用（5173/5174）或旧进程导致接口 404，推荐用：

```bash
yarn dev:kill
```

### 预览打包结果（`yarn preview`）

前后端端口不同，需在 `.env` / `.env.production.local` 中指定 API 根地址，例如：

```env
VITE_API_BASE_URL=http://127.0.0.1:5174
```

并单独运行 `yarn server`。

## 2. 接入真实数据

1. 复制 `.env.example` 为 `.env`
2. 填写你的接口地址：

```env
VITE_ETF_API_URL=https://your-api.example.com/etf/today
ETF_API_URL=https://your-api.example.com/etf/today
```

### 本项目内置接口

- 自选批量：`GET /api/quotes/all`（前端默认使用）
- 单标的（旧接口保留）：`GET /api/etf/today?secid=1.518880`

你也可以通过环境变量改默认标的：

```powershell
cd "D:\AAA项目文件\数据分析盘\etf-monitor"
$env:ETF_SECID="1.518880"
yarn server
```

接口返回 JSON 字段建议包含：

```json
{
  "symbol": "518880.SS",
  "date": "2026-04-10",
  "open": 4.245,
  "close": 4.286,
  "high": 4.302,
  "low": 4.238,
  "volume": 153620000,
  "changeAmount": 0.041,
  "changeRate": 0.97
}
```

> `changeRate` 单位是百分比值（如 `0.97` 代表 `0.97%`）。

## 3. 每日自动生成判断报告

执行：

```bash
yarn report
```

生成结果会写到 `reports/YYYY-MM-DD.md`。

如果是 Windows 任务计划，你可以设置每日执行（示例）：

```powershell
cd "D:\AAA项目文件\数据分析盘\etf-monitor"
yarn report
```

## 4. 每日自动执行建议

你可以在 Windows 任务计划程序中每天收盘后执行 `yarn report`，并在第二天开盘前复盘前一日的规则输出，避免情绪化操作。
