<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" }
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
function cls(rate) {
  if (rate == null || Number.isNaN(Number(rate))) return "";
  if (Number(rate) > 0) return "up";
  if (Number(rate) < 0) return "down";
  return "";
}
</script>

<template>
  <section class="card listCard">
    <div class="titleRow">
      <h2>基金</h2>
      <span class="pill">实时</span>
    </div>

    <div class="list">
      <button
        v-for="row in items"
        :key="row.ok ? row.id + row.kind : row.id + 'err'"
        class="row"
        :class="{ on: row.ok && selectedId === row.id }"
        type="button"
        @click="row.ok && $emit('select', row)"
      >
        <template v-if="row.ok">
          <div class="left">
            <div class="name">{{ row.name }}</div>
            <div class="sub mono">{{ row.symbol }}</div>
          </div>
          <div class="right">
            <div class="price mono">{{ fmtNum(row.close) }}</div>
            <div class="chg mono" :class="cls(row.changeRate)">{{ fmtPct(row.changeRate) }}</div>
          </div>
        </template>
        <template v-else>
          <div class="err">加载失败：{{ row.id }}</div>
        </template>
      </button>
    </div>
  </section>
</template>

<style scoped>
.listCard {
  padding: 14px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.titleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pill {
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: rgba(79, 70, 229, 0.06);
  color: rgba(15, 23, 42, 0.70);
}
.list {
  margin-top: 10px;
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 8px;
  align-content: start;
  overflow-y: auto;
  padding-right: 4px;
}
.row {
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: #ffffff;
  border-radius: 14px;
  padding: 10px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  text-align: left;
}
.row:hover {
  background: rgba(37, 99, 235, 0.04);
}
.row.on {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(37, 99, 235, 0.08);
}
.left {
  min-width: 0;
}
.name {
  font-weight: 700;
  color: rgba(15, 23, 42, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}
.sub {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.45);
}
.right {
  display: grid;
  gap: 4px;
  justify-items: end;
}
.price {
  font-weight: 800;
  color: rgba(15, 23, 42, 0.92);
}
.chg {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.55);
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
</style>

