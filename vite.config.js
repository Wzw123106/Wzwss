import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

/** 浏览器直连东方财富会 CORS 失败，经此前缀由 Vite 转发；preview 默认沿用 server.proxy */
const eastmoneyProxy = {
  "/__em-push2": {
    target: "https://push2.eastmoney.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__em-push2/, "")
  },
  "/__em-push2his": {
    target: "https://push2his.eastmoney.com",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__em-push2his/, "")
  },
  "/__em-fundgz": {
    target: "https://fundgz.1234567.com.cn",
    changeOrigin: true,
    secure: true,
    rewrite: (path) => path.replace(/^\/__em-fundgz/, "")
  },
  "/__em-fund": {
    target: "http://fund.eastmoney.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/__em-fund/, "")
  }
};

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: eastmoneyProxy
  }
});
