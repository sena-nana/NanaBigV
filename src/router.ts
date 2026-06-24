import {
  createRouter,
  createWebHistory,
  type RouterHistory,
} from "vue-router";
import AppShell from "./layouts/AppShell.vue";

const WorkspacePage = () => import("./pages/Workspace.vue");
const LiveConsolePage = () => import("./pages/LiveConsole.vue");
const LiveSetupPage = () => import("./pages/LiveSetup.vue");
const AudienceGroupsPage = () => import("./pages/AudienceGroups.vue");
const TopicLibraryPage = () => import("./pages/TopicLibrary.vue");
const SafetySettingsPage = () => import("./pages/SafetySettings.vue");
const DanmakuRecordsPage = () => import("./pages/DanmakuRecords.vue");
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
          { path: "", redirect: "/workspace" },
          { path: "workspace", component: WorkspacePage, meta: { sidebar: "main", returnable: true } },
          { path: "live", component: LiveConsolePage, meta: { sidebar: "main", returnable: true } },
          { path: "setup", component: LiveSetupPage, meta: { sidebar: "main", returnable: true } },
          { path: "audience-groups", component: AudienceGroupsPage, meta: { sidebar: "main", returnable: true } },
          { path: "topics", component: TopicLibraryPage, meta: { sidebar: "main", returnable: true } },
          { path: "safety", component: SafetySettingsPage, meta: { sidebar: "main", returnable: true } },
          { path: "danmaku-records", component: DanmakuRecordsPage, meta: { sidebar: "main", returnable: true } },
          { path: "danmaku", redirect: "/live" },
          { path: "audience", redirect: "/audience-groups" },
          { path: "quota", redirect: "/settings?tab=provider" },
          { path: "review", redirect: "/danmaku-records" },
          {
            path: "settings",
            component: SettingsPage,
            meta: { sidebar: "settings", lockSidebar: true, returnable: false },
          },
        ],
      },
      { path: "/:pathMatch(.*)*", redirect: "/workspace" },
    ],
  });
}

export const router = createBigVRouter();
