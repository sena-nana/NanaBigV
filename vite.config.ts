/// <reference types="vitest" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const appConfig = JSON.parse(readFileSync(new URL("./app.config.json", import.meta.url), "utf8")) as {
  productTitle: string;
  storageKeyPrefix: string;
};

// @ts-expect-error process 是 Node.js 全局对象
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process 是 Node.js 全局对象
const templateDevPort = Number.parseInt(process.env.TAURI_TEMPLATE_DEV_PORT ?? "", 10);
// @ts-expect-error process 是 Node.js 全局对象
const strictPort = process.env.TAURI_TEMPLATE_DEV_STRICT_PORT === "1";
const port = Number.isInteger(templateDevPort) ? templateDevPort : 1420;

export default defineConfig(async () => ({
  plugins: [
    vue(),
    {
      name: "app-config-html",
      transformIndexHtml(html) {
        return html
          .replaceAll("%APP_PRODUCT_TITLE%", escapeHtml(appConfig.productTitle))
          .replaceAll("%APP_STORAGE_KEY_PREFIX%", escapeHtml(appConfig.storageKeyPrefix));
      },
    },
  ],
  clearScreen: false,
  server: {
    port,
    strictPort: strictPort || port === 1420,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
  },
}));

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
