<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from "vue";

const props = defineProps({
  title: { type: String, default: "" },
  seriesName: { type: String, default: "日K" },
  /** [{ date, open, high, low, close, volume }] */
  candles: { type: Array, default: () => [] },
  /** 场外净值为 true：合成K线，非交易所真实 OHLC */
  synthetic: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" }
});

const elRef = ref(null);
const dialogChartRef = ref(null);
const dialogVisible = ref(false);
const dialogTitle = computed(() => props.title || "K线图");
let chart = null;
let dialogChart = null;
let echartsMod = null;
let resizeHandler = null;
let dialogResizeHandler = null;

function movingAverage(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let s = 0;
    for (let j = 0; j < period; j++) s += values[i - j];
    out.push(Number((s / period).toFixed(6)));
  }
  return out;
}

/** ECharts candlestick: [open, close, lowest, highest] */
function buildCandleOption() {
  const candles = props.candles || [];
  const dates = candles.map((c) => c.date);
  const candleData = candles.map((c) => [c.open, c.close, c.low, c.high]);
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume ?? 0);
  const hasVolume = volumes.some((v) => v > 0);

  const ma5 = movingAverage(closes, 5);
  const ma10 = movingAverage(closes, 10);
  const ma20 = movingAverage(closes, 20);

  const sub = props.synthetic ? "场外净值合成K线（开盘=昨净值，高/低=区间极值；非交易所撮合K线）" : "交易所日K · 前复权";

  if (!hasVolume) {
    return {
      backgroundColor: "transparent",
      animationDuration: 400,
      title: {
        text: props.title,
        subtext: sub,
        left: 12,
        top: 6,
        textStyle: { color: "rgba(15,23,42,0.92)", fontSize: 14, fontWeight: 700 },
        subtextStyle: { color: "rgba(100,116,139,0.95)", fontSize: 11 }
      },
      legend: {
        data: [props.seriesName, "MA5", "MA10", "MA20"],
        top: 50,
        left: "center",
        itemGap: 16,
        textStyle: { color: "rgba(15,23,42,0.65)", fontSize: 11 }
      },
      grid: { left: 56, right: 20, top: 92, bottom: 48, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "cross",
          crossStyle: { color: "rgba(15,23,42,0.2)", width: 1, type: "dashed" }
        },
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: "rgba(17,24,39,0.12)",
        borderWidth: 1,
        textStyle: { color: "rgba(15,23,42,0.92)", fontSize: 12 },
        formatter(params) {
          if (!params?.length) return "";
          const axis = params[0].axisValue;
          const lines = [`<div style="font-weight:700;margin-bottom:4px">${axis}</div>`];
          for (const p of params) {
            if (p.seriesType === "candlestick" && Array.isArray(p.data)) {
              const [o, c, l, h] = p.data;
              lines.push(
                `开盘 <b>${o?.toFixed?.(4) ?? o}</b> &nbsp; 收盘 <b>${c?.toFixed?.(4) ?? c}</b><br/>最低 <b>${l?.toFixed?.(4) ?? l}</b> &nbsp; 最高 <b>${h?.toFixed?.(4) ?? h}</b>`
              );
            } else if (p.value != null && p.value !== "") {
              const v = typeof p.value === "number" ? p.value.toFixed(4) : p.value;
              lines.push(
                `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}：<b>${v}</b>`
              );
            }
          }
          return lines.join("<br/>");
        }
      },
      xAxis: {
        type: "category",
        data: dates,
        boundaryGap: true,
        position: "top",
        axisLine: { lineStyle: { color: "rgba(17,24,39,0.12)" } },
        axisTick: { alignWithLabel: true },
        axisLabel: { color: "rgba(15,23,42,0.5)", fontSize: 11, hideOverlap: true },
        splitLine: { show: true, lineStyle: { color: "rgba(17,24,39,0.06)" } }
      },
      yAxis: {
        type: "value",
        scale: true,
        splitNumber: 5,
        axisLine: { show: false },
        axisLabel: {
          color: "rgba(15,23,42,0.55)",
          fontSize: 11,
          formatter: (v) => (Number.isFinite(v) ? Number(v).toFixed(3) : v)
        },
        splitLine: { lineStyle: { color: "rgba(17,24,39,0.08)", type: "dashed" } },
        splitArea: {
          show: true,
          areaStyle: { color: ["rgba(37,99,235,0.04)", "rgba(255,255,255,0)"] }
        }
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "none" },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 22,
          bottom: 6,
          borderColor: "transparent",
          backgroundColor: "rgba(17,24,39,0.04)",
          fillerColor: "rgba(37,99,235,0.12)",
          handleStyle: { color: "#2563eb" },
          textStyle: { color: "rgba(15,23,42,0.45)", fontSize: 10 }
        }
      ],
      series: [
        {
          name: props.seriesName,
          type: "candlestick",
          data: candleData,
          itemStyle: {
            color: "#ef4444",
            color0: "#16a34a",
            borderColor: "#ef4444",
            borderColor0: "#16a34a"
          },
          emphasis: { focus: "series" },
          z: 3
        },
        {
          name: "MA5",
          type: "line",
          data: ma5,
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 1, color: "#f59e0b" },
          z: 2
        },
        {
          name: "MA10",
          type: "line",
          data: ma10,
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 1, color: "#8b5cf6" },
          z: 2
        },
        {
          name: "MA20",
          type: "line",
          data: ma20,
          smooth: false,
          showSymbol: false,
          lineStyle: { width: 1, color: "#94a3b8" },
          z: 2
        }
      ]
    };
  }

  /* 有成交量：主图K线 + 副图成交量（A股红涨绿跌） */
  const volData = volumes.map((vol, i) => ({
    value: vol,
    itemStyle: {
      color:
        candles[i].close >= candles[i].open ? "rgba(239,68,68,0.55)" : "rgba(22,163,74,0.55)"
    }
  }));

  return {
    backgroundColor: "transparent",
    animationDuration: 400,
    title: {
      text: props.title,
      subtext: sub,
      left: 12,
      top: 6,
      textStyle: { color: "rgba(15,23,42,0.92)", fontSize: 14, fontWeight: 700 },
      subtextStyle: { color: "rgba(100,116,139,0.95)", fontSize: 11 }
    },
    legend: {
      data: [props.seriesName, "MA5", "MA10", "MA20", "成交量"],
      top: 50,
      left: "center",
      itemGap: 14,
      textStyle: { color: "rgba(15,23,42,0.65)", fontSize: 11 }
    },
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    grid: [
      { left: 56, right: 56, top: 92, height: "38%", containLabel: true },
      { left: 56, right: 56, top: "52%", height: "38%" }
    ],
    xAxis: [
      {
        type: "category",
        data: dates,
        boundaryGap: true,
        gridIndex: 0,
        position: "top",
        axisLine: { lineStyle: { color: "rgba(17,24,39,0.12)" } },
        axisLabel: { color: "rgba(15,23,42,0.5)", fontSize: 11, hideOverlap: true },
        axisTick: { alignWithLabel: true },
        splitLine: { show: true, lineStyle: { color: "rgba(17,24,39,0.06)" } }
      },
      {
        type: "category",
        data: dates,
        boundaryGap: true,
        gridIndex: 1,
        axisLine: { lineStyle: { color: "rgba(17,24,39,0.12)" } },
        axisLabel: { color: "rgba(15,23,42,0.5)", fontSize: 11, hideOverlap: true },
        axisTick: { alignWithLabel: true }
      }
    ],
    yAxis: [
      {
        type: "value",
        scale: true,
        gridIndex: 0,
        splitNumber: 5,
        axisLine: { show: false },
        axisLabel: {
          color: "rgba(15,23,42,0.55)",
          fontSize: 11,
          formatter: (v) => (Number.isFinite(v) ? Number(v).toFixed(3) : v)
        },
        splitLine: { lineStyle: { color: "rgba(17,24,39,0.08)", type: "dashed" } },
        splitArea: {
          show: true,
          areaStyle: { color: ["rgba(37,99,235,0.04)", "rgba(255,255,255,0)"] }
        }
      },
      {
        type: "value",
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLine: { show: false },
        axisLabel: { color: "rgba(15,23,42,0.45)", fontSize: 10 },
        splitLine: { show: false }
      }
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "rgba(255,255,255,0.98)",
      borderColor: "rgba(17,24,39,0.12)",
      borderWidth: 1,
      textStyle: { color: "rgba(15,23,42,0.92)", fontSize: 12 },
      formatter(params) {
        if (!params?.length) return "";
        const axis = params[0].axisValue;
        const lines = [`<div style="font-weight:700;margin-bottom:4px">${axis}</div>`];
        for (const p of params) {
          if (p.seriesType === "candlestick" && Array.isArray(p.data)) {
            const [o, c, l, h] = p.data;
            lines.push(
              `开盘 <b>${o?.toFixed?.(4) ?? o}</b> 收盘 <b>${c?.toFixed?.(4) ?? c}</b> 低 <b>${l?.toFixed?.(4) ?? l}</b> 高 <b>${h?.toFixed?.(4) ?? h}</b>`
            );
          } else if (p.seriesName === "成交量" && p.value != null) {
            lines.push(`成交量 <b>${p.value}</b>`);
          } else if (p.value != null && p.value !== "" && p.seriesType === "line") {
            const v = typeof p.value === "number" ? p.value.toFixed(4) : p.value;
            lines.push(`${p.seriesName} <b>${v}</b>`);
          }
        }
        return lines.join("<br/>");
      }
    },
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], filterMode: "none" },
      {
        type: "slider",
        xAxisIndex: [0, 1],
        height: 20,
        bottom: 4,
        borderColor: "transparent",
        backgroundColor: "rgba(17,24,39,0.04)",
        fillerColor: "rgba(37,99,235,0.12)",
        handleStyle: { color: "#2563eb" },
        textStyle: { fontSize: 10, color: "rgba(15,23,42,0.45)" }
      }
    ],
    series: [
      {
        name: props.seriesName,
        type: "candlestick",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: candleData,
        itemStyle: {
          color: "#ef4444",
          color0: "#16a34a",
          borderColor: "#ef4444",
          borderColor0: "#16a34a"
        },
        z: 3
      },
      {
        name: "MA5",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: ma5,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1, color: "#f59e0b" },
        z: 2
      },
      {
        name: "MA10",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: ma10,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1, color: "#8b5cf6" },
        z: 2
      },
      {
        name: "MA20",
        type: "line",
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: ma20,
        smooth: false,
        showSymbol: false,
        lineStyle: { width: 1, color: "#94a3b8" },
        z: 2
      },
      {
        name: "成交量",
        type: "bar",
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volData,
        barMaxWidth: 12
      }
    ]
  };
}

async function ensureChart() {
  if (chart) return;
  await nextTick();
  if (!elRef.value) return;
  if (!echartsMod) {
    echartsMod = await import("echarts");
  }
  chart = echartsMod.init(elRef.value, null, { renderer: "canvas" });
  resizeHandler = () => chart?.resize();
  window.addEventListener("resize", resizeHandler);
}

async function render() {
  if (props.loading || props.error || !props.candles?.length) return;
  await ensureChart();
  if (!chart) return;
  const opt = buildCandleOption();
  chart.setOption(opt, { notMerge: true });
  await nextTick();
  chart.resize();
  if (dialogChart) {
    dialogChart.setOption(opt, { notMerge: true });
    await nextTick();
    dialogChart.resize();
  }
}

async function onDialogOpened() {
  await nextTick();
  if (!dialogChartRef.value || props.loading || props.error || !props.candles?.length) return;
  if (!echartsMod) {
    echartsMod = await import("echarts");
  }
  if (dialogChart) {
    dialogChart.dispose();
    dialogChart = null;
  }
  dialogChart = echartsMod.init(dialogChartRef.value, null, { renderer: "canvas" });
  dialogChart.setOption(buildCandleOption(), { notMerge: true });
  await nextTick();
  dialogChart.resize();
  dialogResizeHandler = () => dialogChart?.resize();
  window.addEventListener("resize", dialogResizeHandler);
}

function onDialogClosed() {
  if (dialogResizeHandler) {
    window.removeEventListener("resize", dialogResizeHandler);
    dialogResizeHandler = null;
  }
  if (dialogChart) {
    dialogChart.dispose();
    dialogChart = null;
  }
}

onUnmounted(() => {
  onDialogClosed();
  if (chart) {
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    chart.dispose();
  }
  chart = null;
  echartsMod = null;
  resizeHandler = null;
});

watch(
  () => [props.candles, props.title, props.seriesName, props.synthetic],
  () => render(),
  { deep: true }
);
</script>

<template>
  <div class="historyChartWrap">
  <section class="card chartCard">
    <div ref="elRef" class="chart"></div>
    <div v-if="loading" class="overlay">
      <div class="state">K线数据加载中...</div>
    </div>
    <div v-else-if="error" class="overlay">
      <div class="state err">{{ error }}</div>
    </div>
    <div v-else-if="!candles?.length" class="overlay">
      <div class="state">暂无K线数据</div>
    </div>
    <button
      type="button"
      class="fsBtn"
      title="全屏查看图表"
      :disabled="loading || !!error || !candles?.length"
      @click="dialogVisible = true"
    >
      全屏
    </button>
  </section>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="80%"
    align-center
    destroy-on-close
    class="kline-dialog"
    append-to-body
    @opened="onDialogOpened"
    @closed="onDialogClosed"
  >
    <div ref="dialogChartRef" class="dialogChartInner"></div>
  </el-dialog>
  </div>
</template>

<style scoped>
.historyChartWrap {
  display: contents;
}
.chartCard {
  /* background: #FFFFFF; */
  padding: 14px 12px 12px;
  position: relative;
  flex: 1;
  min-height: 460px;
  display: flex;
  flex-direction: column;
  background-color: #FFFFFF !important;
}
.fsBtn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 4;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: rgba(15, 23, 42, 0.75);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(17, 24, 39, 0.12);
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.fsBtn:hover:not(:disabled) {
  color: #2563eb;
  border-color: rgba(37, 99, 235, 0.35);
}
.fsBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.chart {
  width: 100%;
  flex: 1;
  min-height: 320px;
  height: auto;
}
.overlay {
  position: absolute;
  inset: 10px;
  z-index: 2;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(17, 24, 39, 0.08);
  display: grid;
  place-items: center;
  pointer-events: none;
}
.state {
  padding: 14px;
  color: rgba(15, 23, 42, 0.65);
}
.err {
  color: #991b1b;
}
</style>

<style>
/* el-dialog 挂载在 body，需非 scoped；约 80% 视口高度给图表区 */
.kline-dialog .el-dialog__body {
  box-sizing: border-box;
  height: calc(80vh - 88px);
  min-height: 280px;
  padding: 8px 12px 16px;
  overflow: hidden;
}
.kline-dialog .dialogChartInner {
  width: 100%;
  height: 100%;
  min-height: 240px;
}
</style>
