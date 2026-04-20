<script setup>
defineProps({
  items: {
    type: Array,
    default: () => []
  },
  selectedId: {
    type: String,
    default: ""
  },
  updatedAt: {
    type: String,
    default: ""
  }
});

defineEmits(["select"]);

function fmtNum(v, digits = 4) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  return Number(v).toFixed(digits);
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return "—";
  const n = Number(v);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function rowClass(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return "";
  if (Number(rate) > 0) return "up";
  if (Number(rate) < 0) return "down";
  return "";
}
</script>

<template>
  <section class="card table-wrap">
    <div class="head">
      <h2>自选基金（实时刷新）</h2>
      <p v-if="updatedAt" class="meta">最近拉取：{{ updatedAt }}</p>
    </div>

    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>现价 / 估值</th>
            <th>涨跌<span class="thSub">（估值）</span></th>
            <th>日涨跌幅<span class="thSub">（披露）</span></th>
            <th>近1年</th>
            <th>昨收 / 净值日</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in items"
            :key="row.ok ? row.id + row.kind : row.id + 'err'"
            :class="[
              row.ok && selectedId === row.id ? 'active' : '',
              row.ok ? rowClass(row.changeRate) : ''
            ]"
            @click="row.ok && $emit('select', row)"
          >
            <template v-if="row.ok">
              <td class="name">{{ row.name || row.label }}</td>
              <td>{{ row.kind === "otc" ? "场外·估值" : "场内" }}</td>
              <td>{{ fmtNum(row.close) }}</td>
              <td :class="rowClass(row.changeRate)">{{ fmtPct(row.changeRate) }}</td>
              <td :class="rowClass(row.officialDayPct)">{{ fmtPct(row.officialDayPct) }}</td>
              <td>
                <span :class="rowClass(row.yearReturnPct)">{{ fmtPct(row.yearReturnPct) }}</span>
                <span v-if="row.yearReturnNote" class="sub yrNote">{{ row.yearReturnNote }}</span>
              </td>
              <td>
                <span class="sub">{{ fmtNum(row.prevClose) }}</span>
                <span v-if="row.date" class="sub"> / {{ row.date }}</span>
              </td>
              <td class="sub note">
                <span v-if="row.quoteNote">{{ row.quoteNote }}</span>
                <span v-else-if="row.kind === 'otc' && row.estimateTime">估值 {{ row.estimateTime }}</span>
                <span v-else-if="row.kind === 'listed'">盘口</span>
                <span v-else>—</span>
              </td>
            </template>
            <template v-else>
              <td colspan="8" class="err">
                {{ row.label }}（{{ row.id }}）加载失败：{{ row.error }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="hint foot">
      「涨跌」为 fundgz 盘中估值；「日涨跌幅」为披露净值最近两期官方涨跌（场外 pingzhong 序列、场内盘口）；「近1年」由净值/K 线回溯约 365 天。点击一行可查看下方走势图。
    </p>
  </section>
</template>

<style scoped>
.table-wrap {
  padding-bottom: 8px;
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.head h2 {
  margin: 0;
}
.meta {
  margin: 0;
  color: rgba(15, 23, 42, 0.55);
  font-size: 13px;
}
.scroll {
  overflow-x: auto;
  margin-top: 12px;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  background: #ffffff;
}
th,
td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.08);
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  color: rgba(15, 23, 42, 0.62);
  font-weight: 600;
  white-space: nowrap;
  background: #ffffff;
}
.thSub {
  display: inline;
  font-size: 11px;
  font-weight: 500;
  color: rgba(15, 23, 42, 0.45);
}
.yrNote {
  display: block;
  margin-top: 2px;
  font-size: 11px;
}
tr:hover td {
  background: rgba(37, 99, 235, 0.04);
}
tr.active td {
  background: rgba(37, 99, 235, 0.08);
}
.name {
  font-weight: 600;
  max-width: 220px;
}
.sub {
  color: rgba(15, 23, 42, 0.50);
  font-size: 13px;
}
.up {
  color: #ef4444;
}
.down {
  color: #16a34a;
}
.err {
  color: #991b1b;
}
.foot {
  margin-top: 12px;
  margin-bottom: 0;
}

td:nth-child(3),
td:nth-child(4),
td:nth-child(5),
td:nth-child(6),
td:nth-child(7) {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

.note {
  max-width: 360px;
}
</style>
