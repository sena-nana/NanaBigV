import {
  createRouter,
  createWebHistory,
  type RouterHistory,
} from "vue-router";
import AppShell from "./layouts/AppShell.vue";

const HomePage = () => import("./pages/Home.vue");
const PluginsPage = () => import("./pages/Plugins.vue");
const SettingsPage = () => import("./pages/Settings.vue");

export function createTemplateRouter(history: RouterHistory = createWebHistory()) {
  return createRouter({
    history,
    routes: [
      {
        path: "/",
        component: AppShell,
        meta: { sidebar: "main", returnable: true },
        children: [
          { path: "", component: HomePage, meta: { sidebar: "main", returnable: true } },
          { path: "plugins", component: PluginsPage, meta: { sidebar: "main", returnable: true } },
          {
            path: "settings",
            component: SettingsPage,
            meta: { sidebar: "settings", lockSidebar: true, returnable: false },
          },
        ],
      },
      { path: "/:pathMatch(.*)*", redirect: "/" },
    ],
  });
}

export const router = createTemplateRouter();
