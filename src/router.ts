import {
  createRouter,
  createWebHistory,
  type RouterHistory,
} from "vue-router";
import AppShell from "./layouts/AppShell.vue";

const DanmakuPage = () => import("./pages/Home.vue");
const QuotaPage = () => import("./pages/Quota.vue");
const AudiencePage = () => import("./pages/Audience.vue");
const ReviewPage = () => import("./pages/Review.vue");
const SettingsPage = () => import("./pages/Settings.vue");

export function createBigVRouter(history: RouterHistory = createWebHistory()) {
  return createRouter({
    history,
    routes: [
      {
        path: "/",
        component: AppShell,
        meta: { sidebar: "main", returnable: true },
        children: [
          { path: "", redirect: "/danmaku" },
          { path: "danmaku", component: DanmakuPage, meta: { sidebar: "main", returnable: true } },
          { path: "quota", component: QuotaPage, meta: { sidebar: "main", returnable: true } },
          { path: "audience", component: AudiencePage, meta: { sidebar: "main", returnable: true } },
          { path: "review", component: ReviewPage, meta: { sidebar: "main", returnable: true } },
          {
            path: "settings",
            component: SettingsPage,
            meta: { sidebar: "settings", lockSidebar: true, returnable: false },
          },
        ],
      },
      { path: "/:pathMatch(.*)*", redirect: "/danmaku" },
    ],
  });
}

export const router = createBigVRouter();
