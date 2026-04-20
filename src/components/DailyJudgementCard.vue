<script setup>
defineProps({
  judgement: {
    type: Object,
    required: true
  }
});
</script>

<template>
  <section class="card judge">
    <div class="top">
      <h2>理性判断</h2>
      <span class="badge">{{ judgement.level }}</span>
    </div>

    <div class="chips">
      <span class="chip mono"><span class="dot"></span><span>振幅</span><strong>{{ judgement.volatility }}%</strong></span>
      <span class="chip"><span class="dot dot2"></span><span>原则</span><strong>先纪律，后判断</strong></span>
    </div>

    <div class="panel">
      <h3>观察要点</h3>
      <ul>
        <li v-for="(point, idx) in judgement.points" :key="idx">{{ point }}</li>
      </ul>
    </div>

    <div class="panel actionPanel">
      <h3>今日动作</h3>
      <p class="action">{{ judgement.action }}</p>
    </div>
  </section>
</template>

<style scoped>
.judge .top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.badge {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(37, 99, 235, 0.18);
  color: rgba(37, 99, 235, 0.90);
  background: rgba(37, 99, 235, 0.08);
  font-weight: 700;
}

.panel {
  margin-top: 12px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  border-radius: 14px;
  padding: 12px 12px;
  background: #ffffff;
}

h3 {
  margin: 0 0 8px;
  font-size: 13px;
  color: rgba(15, 23, 42, 0.82);
}

ul {
  margin: 0;
  padding-left: 18px;
  color: rgba(15, 23, 42, 0.78);
  line-height: 1.7;
}

.actionPanel {
  border-color: rgba(37, 99, 235, 0.12);
  background: rgba(37, 99, 235, 0.06);
}

.action {
  margin: 0;
  color: rgba(15, 23, 42, 0.86);
  line-height: 1.7;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.95);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}
.dot2 {
  background: rgba(79, 70, 229, 0.95);
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
}
</style>
