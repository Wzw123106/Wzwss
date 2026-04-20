import { createRouter, createWebHashHistory } from "vue-router";

const PlaceholderView = { template: "<div></div>" };

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: { name: "funds" } },
    { path: "/funds", name: "funds", component: PlaceholderView },
    { path: "/report", name: "report", component: PlaceholderView },
    { path: "/fortune", name: "fortune", component: PlaceholderView }
  ]
});

export default router;
