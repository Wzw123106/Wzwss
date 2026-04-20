<script setup>
const emit = defineEmits(["open-report", "open-funds", "open-fortune", "open-simulator"]);

defineProps({
  active: { type: String, default: "funds" }
});
</script>

<template>
  <aside class="nav">
    <div class="logo">◆</div>
    <div class="items">
      <button class="item" :class="{ on: active === 'funds' }" title="基金" @click="emit('open-funds')">
        <span class="dot"></span>
      </button>
      <button class="item" :class="{ on: active === 'report' }" title="报告" @click="emit('open-report')">
        <span class="dot"></span>
      </button>
      <button class="item" :class="{ on: active === 'fortune' }" title="小六壬" @click="emit('open-fortune')">
        <span class="dot"></span>
      </button>
      <button class="item" :class="{ on: active === 'simulator' }" title="模拟器" @click="emit('open-simulator')">
        <span class="dot"></span>
      </button>
    </div>
    <div class="bottom">
      <button class="item" title="账号">
        <span class="dot"></span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.nav {
  width: 64px;
  height: 100%;
  min-height: 0;
  border-radius: 18px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.10);
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.logo {
  height: 44px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #4f46e5;
  border: 1px solid rgba(79, 70, 229, 0.14);
  background: rgba(79, 70, 229, 0.06);
  font-weight: 900;
}
.items {
  display: grid;
  gap: 10px;
  padding-top: 6px;
}
.bottom {
  margin-top: auto;
}
.item {
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: #ffffff;
  color: rgba(15, 23, 42, 0.72);
  cursor: pointer;
}
.item.on {
  border-color: rgba(37, 99, 235, 0.22);
  background: rgba(37, 99, 235, 0.10);
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.45);
  box-shadow: 0 0 0 4px rgba(15, 23, 42, 0.06);
}
.item.on .dot {
  background: rgba(37, 99, 235, 0.95);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}
</style>

