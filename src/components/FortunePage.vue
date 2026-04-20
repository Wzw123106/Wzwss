<script setup>
import { ref } from "vue";
import fortuneBarrelImg from "../img/44.png";
import fortuneStickImg from "../img/99.png";

const data = [
  {
    name: "大安",
    luck: "大吉 · 平安顺利",
    cls: "good",
    info: "身不动时属木，凡事主安稳。诸事平稳，可守成，不宜妄动，出行平安，谋事可成。"
  },
  {
    name: "留连",
    luck: "中平 · 拖延纠缠",
    cls: "normal",
    info: "人未归时属水，凡事主拖延。事情易反复，进展较慢，不宜急进，宜耐心等待。"
  },
  {
    name: "速喜",
    luck: "吉 · 喜事速至",
    cls: "good",
    info: "人便至时属火，凡事主快速。喜讯快到，谋事速成，出行顺利，有意外之喜。"
  },
  {
    name: "赤口",
    luck: "小凶 · 口舌是非",
    cls: "bad",
    info: "官事凶时属金，凡事主口舌。易有争执、纠纷，宜谨慎言语，少与人争，守静为吉。"
  },
  {
    name: "小吉",
    luck: "吉 · 凡事称心",
    cls: "good",
    info: "人来喜时属木，凡事主和合。小事吉昌，人缘好，谋事有望，顺利称心。"
  },
  {
    name: "空亡",
    luck: "凶 · 诸事不利",
    cls: "bad",
    info: "音信稀时属土，凡事主虚空。谋事多阻，难有结果，宜守不宜进，静待时机。"
  }
];

const barrelDisabled = ref(false);
const stickShake = ref(false);
const dropStickActive = ref(false);
const dropStickReady = ref(false);
const resultShow = ref(false);
const resultName = ref("");
const resultLuck = ref("");
const resultCls = ref("");
const resultInfo = ref("");

function showResult() {
  const idx = Math.floor(Math.random() * data.length);
  const item = data[idx];
  resultName.value = item.name;
  resultLuck.value = item.luck;
  resultCls.value = item.cls;
  resultInfo.value = item.info;
  resultShow.value = true;
}

function shake() {
  if (barrelDisabled.value) return;
  barrelDisabled.value = true;
  dropStickActive.value = false;
  dropStickReady.value = false;
  stickShake.value = true;
  setTimeout(() => {
    dropStickActive.value = true;
  }, 220);
  setTimeout(() => {
    stickShake.value = false;
  }, 760);
}

function reset() {
  resultShow.value = false;
  stickShake.value = false;
  dropStickActive.value = false;
  dropStickReady.value = false;
  barrelDisabled.value = false;
}

function onDropStickAnimationEnd() {
  if (dropStickActive.value && !resultShow.value) {
    dropStickReady.value = true;
  }
}

function onDropStickClick() {
  if (!dropStickReady.value || resultShow.value) return;
  showResult();
}
</script>

<template>
  <section class="fortunePage card">
    <div class="title">小六壬摇签筒</div>
    <div class="desc">点击签桶，诚心求签，自动判断吉凶</div>

    <div class="barrel-box" :class="{ disabled: barrelDisabled }" @click="shake">
      <div class="barrel">
        <img class="barrel-image" :class="{ shake: stickShake }" :src="fortuneBarrelImg" alt="签筒" />
        <img
          class="drop-stick"
          :class="{ active: dropStickActive, ready: dropStickReady, hide: resultShow }"
          :src="fortuneStickImg"
          alt="签"
          @animationend="onDropStickAnimationEnd"
          @click.stop="onDropStickClick"
        />
      </div>
    </div>

    <div class="result" :class="{ show: resultShow }">
      <div class="name">{{ resultName }}</div>
      <div class="luck" :class="resultCls">{{ resultLuck }}</div>
      <div class="info">{{ resultInfo }}</div>
      <button type="button" @click="reset">再求一签</button>
    </div>
  </section>
</template>

<style scoped>
.fortunePage {
  background: #FEEBCD;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 15px;
  color: #333;
  overflow: auto;
}
.title {
  font-size: 26px;
  color: #8b4513;
  margin-bottom: 10px;
}
.desc {
  color: #996b4a;
  font-size: 14px;
  margin-bottom: 24px;
}
.barrel-box {
  position: relative;
  width: 240px;
  height: 320px;
  cursor: pointer;
  margin-bottom: 20px;
}
.barrel-box.disabled {
  pointer-events: none;
}
.barrel {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  position: relative;
}
.drop-stick {
  position: absolute;
  width: 120px;
  height: auto;
  left: 50%;
  top: 52%;
  opacity: 0;
  transform: translate(-50%, -42%) rotate(-6deg) scale(0.95);
  transform-origin: 50% 88%;
  pointer-events: none;
  z-index: 4;
  clip-path: inset(0 0 10% 0);
}
.drop-stick.active {
  animation: stickDropToGround 1.15s cubic-bezier(0.18, 0.72, 0.22, 1) forwards;
}
.drop-stick.ready {
  pointer-events: auto;
  cursor: pointer;
}
.drop-stick.hide {
  opacity: 0 !important;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.barrel-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transform-origin: 50% 75%;
  clip-path: inset(0 0 10% 0);
}
.barrel-image.shake {
  animation: shake 0.7s ease-in-out;
}
@keyframes shake {
  0% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-14deg);
  }
  50% {
    transform: rotate(10deg);
  }
  75% {
    transform: rotate(-6deg);
  }
  100% {
    transform: rotate(0deg);
  }
}
@keyframes stickDropToGround {
  0% {
    opacity: 0;
    transform: translate(-50%, -42%) rotate(-6deg) scale(0.95);
  }
  10% {
    opacity: 1;
  }
  55% {
    opacity: 1;
    transform: translate(13%, -21%) rotate(44deg) scale(1);
  }
  74% {
    opacity: 1;
    transform: translate(15%, -9%) rotate(39deg) scale(0.97);
  }
  100% {
    opacity: 1;
    transform: translate(14%, -15%) rotate(41deg) scale(1);
  }
}
.result {
  margin-top: 20px;
  background: #fff;
  padding: 20px 25px;
  border-radius: 12px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  max-width: 340px;
  text-align: center;
  display: none;
  border: 1px solid #e8c197;
}
.result.show {
  display: block;
  animation: fadeIn 0.5s forwards;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.result .name {
  font-size: 24px;
  font-weight: bold;
  color: #8b4513;
  margin-bottom: 8px;
}
.result .luck {
  font-size: 18px;
  margin-bottom: 12px;
}
.result .luck.good {
  color: #d4380d;
}
.result .luck.normal {
  color: #666;
}
.result .luck.bad {
  color: #222;
}
.result .info {
  font-size: 14px;
  line-height: 1.6;
  color: #555;
  text-align: left;
}
button {
  margin-top: 15px;
  padding: 10px 24px;
  background: #8b4513;
  color: #fff;
  border: none;
  border-radius: 30px;
  font-size: 15px;
  cursor: pointer;
  transition: 0.2s;
}
button:hover {
  background: #a3541a;
}
</style>
