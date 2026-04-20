<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import DailyJudgementCard from "./components/DailyJudgementCard.vue";
import HistoryChart from "./components/HistoryChart.vue";
import SidebarNav from "./components/SidebarNav.vue";
import FundList from "./components/FundList.vue";
import WatchlistTable from "./components/WatchlistTable.vue";
import FortunePage from "./components/FortunePage.vue";
import SimulatorPage from "./components/SimulatorPage.vue";
import { createQuotesPoller, fetchAllQuotes } from "./services/quotesService";
import { buildRationalJudgement } from "./utils/judgementEngine";
import { fetchHistory } from "./services/historyService";
import { WATCHLIST } from "./config/watchlist";
import kpiIconBeer from "./img/美食_啤酒.png";
import kpiIconFries from "./img/美食_薯条.png";
import kpiIconCheese from "./img/美食_奶酪.png";

const POLL_MS = Number(import.meta.env.VITE_POLL_MS) || 2000;

const loading = ref(true);
const loadError = ref("");
const quotesPayload = ref({ updatedAt: "", items: [] });
const selectedId = ref("");
const loadedHistoryId = ref("");
const reportCodeInput = ref("");
const reportMsg = ref("");
const addingCode = ref(false);
const restoringFundsView = ref(false);
const selectedSuggestion = ref(null);
const reportDetailVisible = ref(false);
const reportDetailLoading = ref(false);
const reportDetailError = ref("");
const reportDetailCandles = ref([]);
const reportDetailSynthetic = ref(false);
const reportDetailSeriesName = ref("日K");
const reportDetailTitle = ref("");
const reportDetailRow = ref(null);
const reportTableRef = ref(null);
const selectedReportIds = ref([]);
const isRestoringReportSelection = ref(false);
const WATCHLIST_STORAGE_KEY = "etf-monitor-watchlist";
const route = useRoute();
const router = useRouter();
const currentPage = computed(() => {
  if (route.name === "report") return "report";
  if (route.name === "fortune") return "fortune";
  if (route.name === "simulator") return "simulator";
  return "funds";
});

function loadWatchlist() {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return WATCHLIST.map((x) => ({ ...x }));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return WATCHLIST.map((x) => ({ ...x }));
    return parsed.map((x) => ({ ...x }));
  } catch {
    return WATCHLIST.map((x) => ({ ...x }));
  }
}

const watchlist = ref(loadWatchlist());

function persistWatchlist() {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist.value));
}

let poller = null;

const historyLoading = ref(false);
const historyError = ref("");
const historyCandles = ref([]);
const historySynthetic = ref(false);
const historySeriesName = ref("日K");
const historyTitle = ref("");

const okItems = computed(() => (quotesPayload.value.items || []).filter((x) => x && x.ok));
const upCount = computed(() => okItems.value.filter((x) => Number(x.changeRate) > 0).length);
const downCount = computed(() => okItems.value.filter((x) => Number(x.changeRate) < 0).length);
const flatCount = computed(() => okItems.value.length - upCount.value - downCount.value);

const selectedRow = computed(() => {
  const items = quotesPayload.value.items || [];
  const hit = items.find((r) => r.ok && r.id === selectedId.value);
  return hit || null;
});

const reportRows = computed(() => {
  const byId = new Map((quotesPayload.value.items || []).filter((x) => x?.ok).map((x) => [x.id, x]));
  return watchlist.value.map((entry) => {
    const q = byId.get(entry.id);
    return {
      ...entry,
      ...(q || {}),
      close: q?.close ?? null,
      changeRate: q?.changeRate ?? null
    };
  });
});

const reportDetailJudgement = computed(() => {
  const r = reportDetailRow.value;
  if (!r) return null;
  return buildRationalJudgement({
    symbol: r.symbol,
    date: r.date,
    open: r.open,
    close: r.close,
    high: r.high,
    low: r.low,
    volume: r.volume,
    changeAmount: r.changeAmount,
    changeRate: r.changeRate,
    officialDayPct: r.officialDayPct,
    yearReturnPct: r.yearReturnPct
  });
});

function todayShanghaiDate() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .format(new Date())
    .replace(/\//g, "-");
}

function withTodayEstimateCandle(candles, row) {
  const arr = Array.isArray(candles) ? [...candles] : [];
  if (!arr.length || !row || row.kind !== "otc") return arr;
  const estimateClose = Number(row.close);
  if (!Number.isFinite(estimateClose)) return arr;

  const today = todayShanghaiDate();
  const last = arr[arr.length - 1];
  if (!last?.date || last.date >= today) return arr;

  const base = Number(last.close);
  const open = Number.isFinite(base) ? base : estimateClose;
  arr.push({
    date: today,
    open,
    high: Math.max(open, estimateClose),
    low: Math.min(open, estimateClose),
    close: estimateClose,
    volume: 0,
    estimated: true
  });
  return arr;
}

async function loadHistory(row) {
  historyLoading.value = true;
  historyError.value = "";
  historyCandles.value = [];
  historySynthetic.value = false;
  loadedHistoryId.value = row?.id || "";
  try {
    const kind = row.kind;
    const secid = kind === "listed" ? (row.symbol?.endsWith(".SH") ? `1.${row.symbol.split(".")[0]}` : `0.${row.symbol.split(".")[0]}`) : "";
    const data = await fetchHistory({ id: row.id, kind, secid, days: 180 });
    historyCandles.value = withTodayEstimateCandle(data.candles || [], row);
    historySynthetic.value = !!data.synthetic;
    historySeriesName.value = data.seriesName || "日K";
    historyTitle.value = `${row.name} · 近180日K`;
  } catch (e) {
    historyError.value = e.message || String(e);
  } finally {
    historyLoading.value = false;
  }
}

const judgement = computed(() => {
  if (!selectedRow.value) return null;
  const r = selectedRow.value;
  return buildRationalJudgement({
    symbol: r.symbol,
    date: r.date,
    open: r.open,
    close: r.close,
    high: r.high,
    low: r.low,
    volume: r.volume,
    changeAmount: r.changeAmount,
    changeRate: r.changeRate,
    officialDayPct: r.officialDayPct,
    yearReturnPct: r.yearReturnPct
  });
});

function onQuotes(err, data) {
  loading.value = false;
  if (err) {
    loadError.value = err.message || String(err);
    return;
  }
  loadError.value = "";
  quotesPayload.value = data;

  const okRows = (data?.items || []).filter((r) => r && r.ok);
  if (!okRows.length) return;

  const current = okRows.find((r) => r.id === selectedId.value) || null;
  if (!current) {
    const first = okRows[0];
    selectedId.value = first.id;
    void loadHistory(first);
    return;
  }

  if (!loadedHistoryId.value) {
    void loadHistory(current);
  }
}

function selectRow(row) {
  selectedId.value = row.id;
  loadHistory(row);
}

async function refreshOnce() {
  loading.value = true;
  try {
    const data = await fetchAllQuotes(watchlist.value);
    onQuotes(null, data);
  } catch (e) {
    onQuotes(e, null);
  }
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    void refreshOnce();
  }
}

onMounted(() => {
  poller = createQuotesPoller(onQuotes, POLL_MS, () => watchlist.value);
  poller.start();
  document.addEventListener("visibilitychange", onVisibilityChange);
});

onUnmounted(() => {
  if (poller) poller.stop();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});

function fmtPctSel(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function selYearClass(v) {
  if (v == null || Number.isNaN(Number(v))) return "";
  if (Number(v) > 0) return "pctUp";
  if (Number(v) < 0) return "pctDown";
  return "";
}

function fmtNum(v, digits = 4) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(digits);
}

function fmtUpdatedAt(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return String(v);
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
}

function rateStyle(v) {
  if (v == null || Number.isNaN(Number(v))) return {};
  if (Number(v) > 0) return { color: "#ef4444", fontWeight: 700 };
  if (Number(v) < 0) return { color: "#16a34a", fontWeight: 700 };
  return { color: "rgba(15,23,42,0.72)" };
}

function buildReportAdviceText() {
  const j = reportDetailJudgement.value;
  if (!j) return "数据不足，建议先观望。";
  const level = j.level || "";
  if (level.includes("明显回撤") || level.includes("温和回调")) {
    return "建议：可考虑小步分批买入，避免一次性重仓。";
  }
  if (level.includes("偏强上涨") || level.includes("温和上涨")) {
    return "建议：当前不追高，等待回踩或按原计划定投。";
  }
  return "建议：暂时观望，等待更明确的信号。";
}

async function openReportDetail(row) {
  reportDetailVisible.value = true;
  reportDetailLoading.value = true;
  reportDetailError.value = "";
  reportDetailCandles.value = [];
  reportDetailRow.value = row;
  reportDetailTitle.value = `${row.name || row.id} · 往期价格`;
  try {
    let secid = "";
    if (row.kind === "listed" && row.symbol) {
      secid = row.symbol.endsWith(".SH") ? `1.${row.symbol.split(".")[0]}` : `0.${row.symbol.split(".")[0]}`;
    }
    const data = await fetchHistory({ id: row.id, kind: row.kind || "otc", secid, days: 180 });
    reportDetailCandles.value = withTodayEstimateCandle(data.candles || [], row);
    reportDetailSynthetic.value = !!data.synthetic;
    reportDetailSeriesName.value = data.seriesName || "日K";
  } catch (e) {
    reportDetailError.value = e.message || String(e);
  } finally {
    reportDetailLoading.value = false;
  }
}

function openReportPage() {
  router.push({ name: "report" });
}

function openFundsPage() {
  router.push({ name: "funds" });
}

function openFortunePage() {
  router.push({ name: "fortune" });
}

function openSimulatorPage() {
  router.push({ name: "simulator" });
}

async function restoreFundsView() {
  if (restoringFundsView.value) return;
  restoringFundsView.value = true;
  try {
    let okRows = (quotesPayload.value.items || []).filter((r) => r && r.ok);
    if (!okRows.length) {
      await refreshOnce();
      okRows = (quotesPayload.value.items || []).filter((r) => r && r.ok);
    }
    if (!okRows.length) return;
    const current = okRows.find((r) => r.id === selectedId.value) || okRows[0];
    if (selectedId.value !== current.id) selectedId.value = current.id;
    await loadHistory(current);
  } finally {
    restoringFundsView.value = false;
  }
}

async function queryFundSuggestions(queryString, cb) {
  const code = String(queryString || "").trim();
  if (!/^\d{6}$/.test(code)) {
    reportMsg.value = code.length > 0 ? "请输入 6 位基金代码进行查询" : "";
    cb([]);
    return;
  }
  try {
    const preview = await fetchAllQuotes([{ id: code, kind: "otc" }]);
    const hit = (preview?.items || []).find((x) => x && x.ok && x.id === code) || null;
    if (!hit) {
      reportMsg.value = "未找到该基金代码，请确认后重试";
      cb([]);
      return;
    }
    reportMsg.value = "";
    cb([
      {
        value: `${hit.id} - ${hit.name || hit.label || hit.id}`,
        id: hit.id,
        name: hit.name || hit.label || hit.id,
        kind: "otc"
      }
    ]);
  } catch {
    reportMsg.value = "查询失败，请稍后重试";
    cb([]);
  }
}

function onSuggestionSelect(item) {
  selectedSuggestion.value = {
    id: item.id,
    name: item.name,
    kind: item.kind || "otc"
  };
  reportMsg.value = "";
}

function onCodeInputChange() {
  selectedSuggestion.value = null;
  if (!reportCodeInput.value) reportMsg.value = "";
}

async function addWatchlistCode() {
  if (!selectedSuggestion.value) {
    reportMsg.value = "请先从下拉结果中选择基金名称，再点击新增";
    return;
  }
  const { id, name, kind } = selectedSuggestion.value;
  if (watchlist.value.some((x) => x.id === id)) {
    reportMsg.value = "该代码已在列表中";
    return;
  }
  addingCode.value = true;
  reportMsg.value = "";
  try {
    watchlist.value = [...watchlist.value, { id, name, kind: kind || "otc" }];
    reportCodeInput.value = "";
    selectedSuggestion.value = null;
    reportMsg.value = "";
    persistWatchlist();
    await refreshOnce();
    ElMessage.success("已添加到列表");
  } catch {
    reportMsg.value = "添加失败，请稍后重试";
  } finally {
    addingCode.value = false;
  }
}

async function removeWatchlistCode(id) {
  try {
    await ElMessageBox.confirm("删除后将从自选列表移除，是否继续？", "确认删除", {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  watchlist.value = watchlist.value.filter((x) => x.id !== id);
  selectedReportIds.value = selectedReportIds.value.filter((x) => x !== id);
  if (selectedId.value === id) {
    selectedId.value = "";
    loadedHistoryId.value = "";
    historyCandles.value = [];
  }
  persistWatchlist();
  refreshOnce();
  ElMessage.success("已删除");
}

function onReportSelectionChange(rows) {
  if (isRestoringReportSelection.value) return;
  selectedReportIds.value = Array.isArray(rows) ? rows.map((x) => x.id) : [];
}

async function restoreReportSelection() {
  if (currentPage.value !== "report") return;
  const table = reportTableRef.value;
  if (!table) return;
  if (!selectedReportIds.value.length) return;
  const selectedSet = new Set(selectedReportIds.value);
  await nextTick();
  isRestoringReportSelection.value = true;
  try {
    table.clearSelection?.();
    for (const row of reportRows.value) {
      if (selectedSet.has(row.id)) {
        table.toggleRowSelection?.(row, true);
      }
    }
  } finally {
    isRestoringReportSelection.value = false;
  }
}

async function removeSelectedWatchlistCodes() {
  const ids = [...selectedReportIds.value];
  if (!ids.length) return;
  try {
    await ElMessageBox.confirm(`将删除已选中的 ${ids.length} 条基金，是否继续？`, "批量删除确认", {
      confirmButtonText: "确认删除",
      cancelButtonText: "取消",
      type: "warning"
    });
  } catch {
    return;
  }

  const idSet = new Set(ids);
  watchlist.value = watchlist.value.filter((x) => !idSet.has(x.id));
  selectedReportIds.value = [];
  reportTableRef.value?.clearSelection?.();

  if (selectedId.value && idSet.has(selectedId.value)) {
    selectedId.value = "";
    loadedHistoryId.value = "";
    historyCandles.value = [];
  }

  persistWatchlist();
  await refreshOnce();
  ElMessage.success(`已删除 ${ids.length} 条`);
}

watch(
  () => currentPage.value,
  (page) => {
    if (page === "funds") {
      void restoreFundsView();
    } else if (page === "report") {
      void restoreReportSelection();
    }
  }
);

watch(
  () => [reportRows.value.length, currentPage.value],
  ([, page]) => {
    if (page === "report" && selectedReportIds.value.length) {
      void restoreReportSelection();
    }
  }
);
</script>

<template>
  <main class="layout">
    <div class="frame">
      <div class="shell" :class="{ reportMode: currentPage !== 'funds' }">
      <SidebarNav
        :active="currentPage"
        @open-report="openReportPage"
        @open-funds="openFundsPage"
        @open-fortune="openFortunePage"
        @open-simulator="openSimulatorPage"
      />

      <FundList v-if="currentPage === 'funds'" :items="quotesPayload.items" :selected-id="selectedId" @select="selectRow" />

      <section class="mainCol">
        <template v-if="currentPage === 'funds'">
        <header class="card">
          <div class="topRow">
            <div>
              <h1>总览</h1>
              <p class="hint">每 {{ POLL_MS / 1000 }} 秒刷新。点击左侧基金查看明细与走势图。</p>
            </div>
            <button class="btn" type="button" :disabled="loading" @click="refreshOnce">
              {{ loading ? "刷新中..." : "立即刷新" }}
            </button>
          </div>

          <div class="kpiRow">
            <div class="kpiCard blue">
              <div>
                <div class="klabel">上涨 / 下跌 / 持平</div>
                <div class="kvalue mono">
                  <span style="color:var(--up)">{{ upCount }}</span>
                  <span style="color:rgba(255,255,255,0.55)"> / </span>
                  <span style="color:var(--down)">{{ downCount }}</span>
                  <span style="color:rgba(255,255,255,0.55)"> / </span>
                  <span style="color:#fff">{{ flatCount }}</span>
                </div>
              </div>
              <div class="icon"><img class="iconImg" :src="kpiIconBeer" alt="" /></div>
            </div>
            <div class="kpiCard orange">
              <div>
                <div class="klabel">选中基金现价/估值</div>
                <div class="kvalue mono">{{ selectedRow?.close ?? "—" }}</div>
                <div v-if="selectedRow" class="kpiYear mono" :class="selYearClass(selectedRow.yearReturnPct)">
                  近1年 {{ fmtPctSel(selectedRow.yearReturnPct) }}
                  <span v-if="selectedRow.yearReturnNote" class="kpiYearNote">{{ selectedRow.yearReturnNote }}</span>
                </div>
              </div>
              <div class="icon"><img class="iconImg" :src="kpiIconFries" alt="" /></div>
            </div>
            <div class="kpiCard indigo">
              <div>
                <div class="klabel">近一次更新时间</div>
                <div class="kvalue mono" style="font-size:14px;font-weight:800;">
                  {{ fmtUpdatedAt(quotesPayload.updatedAt) }}
                </div>
              </div>
              <div class="icon"><img class="iconImg" :src="kpiIconCheese" alt="" /></div>
            </div>
          </div>
        </header>

        <section v-if="loadError" class="card error">{{ loadError }}</section>

        <div class="midGrid">
          <div class="card detailCol" v-if="selectedRow">
            <div class="topRow" style="margin-bottom:10px;">
              <h2>{{ selectedRow.name }}</h2>
              <span class="chip mono">{{ selectedRow.symbol }}</span>
            </div>
            <WatchlistTable
              :items="[selectedRow]"
              :updated-at="quotesPayload.updatedAt"
              :selected-id="selectedId"
              @select="selectRow"
            />
            <DailyJudgementCard v-if="judgement" :judgement="judgement" />
          </div>

          <div class="chartCol">
            <HistoryChart
              v-if="selectedRow"
              :title="historyTitle"
              :series-name="historySeriesName"
              :candles="historyCandles"
              :synthetic="historySynthetic"
              :loading="historyLoading"
              :error="historyError"
            />
          </div>
        </div>
        </template>
        <section v-else-if="currentPage === 'report'" class="card reportCard">
          <div class="reportToolbar">
            <el-form :inline="true" class="reportForm">
              <el-form-item label="基金代码">
                <el-autocomplete
                  v-model.trim="reportCodeInput"
                  :fetch-suggestions="queryFundSuggestions"
                  placeholder="请输入6位基金代码"
                  maxlength="6"
                  clearable
                  :disabled="addingCode"
                  value-key="value"
                  @change="onCodeInputChange"
                  @select="onSuggestionSelect"
                  @keyup.enter="addWatchlistCode"
                >
                  <template #default="{ item }">
                    <div class="suggestItem">
                      <span class="mono">{{ item.id }}</span>
                      <span>{{ item.name }}</span>
                    </div>
                  </template>
                </el-autocomplete>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="addingCode" @click="addWatchlistCode">
                  {{ addingCode ? "加入中" : "新增" }}
                </el-button>
                <el-button @click="reportCodeInput = ''; selectedSuggestion = null; reportMsg = ''">重置</el-button>
                <el-button
                  v-if="selectedReportIds.length"
                  type="danger"
                  @click="removeSelectedWatchlistCodes"
                >
                  全部删除（已选{{ selectedReportIds.length }}项）
                </el-button>
              </el-form-item>
            </el-form>
            <div class="reportMeta mono">共 {{ watchlist.length }} 条</div>
          </div>

          <el-alert
            v-if="reportMsg"
            :title="reportMsg"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 10px;"
          />

          <div class="reportTableWrap">
            <el-table
              ref="reportTableRef"
              :data="reportRows"
              border
              stripe
              size="small"
              height="100%"
              row-key="id"
              class="reportTableEl"
              @selection-change="onReportSelectionChange"
            >
              <el-table-column type="selection" width="46" align="center" :reserve-selection="true" />
              <el-table-column type="index" label="序号" width="70" />
              <el-table-column prop="id" label="代码" min-width="120" />
              <el-table-column prop="name" label="名称" min-width="220" show-overflow-tooltip />
              <el-table-column label="类型" width="100">
                <template #default="{ row }">
                  <el-button
                    v-if="row.kind === 'listed'"
                    class="kindBtn kindListed"
                    type="success"
                    size="small"
                    plain
                    @click="openReportDetail(row)"
                  >
                    场内
                  </el-button>
                  <el-button v-else class="kindBtn kindOtc" type="warning" size="small" @click="openReportDetail(row)">
                    场外
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column label="现价/估值" min-width="120">
                <template #default="{ row }">
                  <span class="mono priceCell">{{ fmtNum(row.close) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="实时涨跌" min-width="120">
                <template #default="{ row }">
                  <span class="mono" :style="rateStyle(row.changeRate)">{{ fmtPctSel(row.changeRate) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="90" fixed="right">
                <template #default="{ row }">
                  <div class="opBtns">
                    <el-button class="opBtn delBtn" type="danger" size="small" @click="removeWatchlistCode(row.id)">
                      删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <el-drawer
            v-model="reportDetailVisible"
            title="基金分析详情"
            size="50%"
            :with-header="true"
            destroy-on-close
            class="reportDetailDrawer"
          >
            <section class="reportDetailPanel">
              <div class="topRow">
                <h2>{{ reportDetailTitle }}</h2>
                <span class="chip mono">{{ reportDetailRow?.id || "—" }}</span>
              </div>
              <p class="hint" style="margin-top: 8px;">{{ buildReportAdviceText() }}</p>

              <div class="detailStats">
                <div class="sItem">
                  <span>现价/估值</span>
                  <strong class="mono">{{ fmtNum(reportDetailRow?.close) }}</strong>
                </div>
                <div class="sItem">
                  <span>实时涨跌</span>
                  <strong class="mono" :style="rateStyle(reportDetailRow?.changeRate)">{{ fmtPctSel(reportDetailRow?.changeRate) }}</strong>
                </div>
                <div class="sItem">
                  <span>算法等级</span>
                  <strong>{{ reportDetailJudgement?.level || "—" }}</strong>
                </div>
              </div>

              <div class="drawerChartWrap">
                <HistoryChart
                  :title="reportDetailTitle"
                  :series-name="reportDetailSeriesName"
                  :candles="reportDetailCandles"
                  :synthetic="reportDetailSynthetic"
                  :loading="reportDetailLoading"
                  :error="reportDetailError"
                />
              </div>
            </section>
          </el-drawer>
        </section>
        <FortunePage v-else-if="currentPage === 'fortune'" />
        <SimulatorPage v-else />
      </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.kpiYear {
  margin-top: 6px;
  font-size: 15px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.92);
}
.kpiYear.pctUp {
  color: #fecaca;
}
.kpiYear.pctDown {
  color: #bbf7d0;
}
.kpiYearNote {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.88;
}
.reportCard {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
}
.reportToolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: #f8fbff;
  border: 1px solid rgba(59, 130, 246, 0.16);
  border-radius: 10px;
}
.reportForm {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.reportForm :deep(.el-form-item) {
  margin-bottom: 0;
}
.reportForm :deep(.el-autocomplete) {
  width: 280px;
}
.reportMeta {
  color: rgba(15, 23, 42, 0.6);
  font-size: 13px;
}
.reportTableWrap {
  flex: 1;
  min-height: 0;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 10px;
  overflow: hidden;
}
.reportDetailPanel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.detailStats {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}
.sItem {
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  display: grid;
  gap: 4px;
}
.sItem span {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.58);
}
.sItem strong {
  font-size: 16px;
  color: #111827;
}
.drawerChartWrap {
  flex: 1;
  min-height: 0;
  display: flex;
}
.drawerChartWrap :deep(.historyChartWrap) {
  width: 100%;
}
.reportTableEl :deep(.el-table__header th) {
  background: #eef8ff;
  color: rgba(15, 23, 42, 0.72);
  font-weight: 700;
  height: 40px;
  font-size: 14px;
  text-align: center;
}
.reportTableEl :deep(.el-table__row td) {
  height: 40px;
  color: rgba(15, 23, 42, 0.86);
  font-size: 14px;
  text-align: center;
}
.reportTableEl :deep(.el-table__row:hover > td) {
  background: #f7fbff !important;
}
.reportTableEl :deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background: #fcfeff;
}
.reportTableEl :deep(.priceCell) {
  color: #1f2937;
  font-weight: 700;
}
.reportTableEl :deep(.kindBtn) {
  border-radius: 6px;
  padding: 0 10px;
  height: 24px;
  line-height: 22px;
  font-weight: 400;
  margin: 0;
}
.reportTableEl :deep(.kindListed) {
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.35);
  background: rgba(34, 197, 94, 0.12);
}
.reportTableEl :deep(.kindOtc) {
  --el-button-bg-color: #f59e0b;
  --el-button-border-color: #f59e0b;
  --el-button-hover-bg-color: #d97706;
  --el-button-hover-border-color: #d97706;
  --el-button-active-bg-color: #b45309;
  --el-button-active-border-color: #b45309;
}
.opBtns {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.opBtn {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
}
.delBtn {
  --el-button-bg-color: #fb6a6a;
  --el-button-border-color: #fb6a6a;
  --el-button-hover-bg-color: #f25757;
  --el-button-hover-border-color: #f25757;
}
.iconImg {
  width: 34px;
  height: 34px;
  object-fit: contain;
  display: block;
}
.icon {
  display: grid;
  place-items: center;
}
.suggestItem {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}
.suggestItem span:last-child {
  color: rgba(15, 23, 42, 0.82);
}
</style>

<style>
.reportDetailDrawer {
  min-width: 760px;
}
</style>
