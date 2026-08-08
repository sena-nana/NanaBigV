/// <reference types="vitest" />
import { defineLiliaViteConfig } from "@lilia/config";
import appConfig from "./app.config.json";
import { uiBundleGuard } from "./scripts/ui-bundle-guard";

export default defineLiliaViteConfig({
  plugins: [uiBundleGuard((appConfig.ui?.preset as "lilia" | "nana") ?? "lilia")],
  test: {
    server: {
      deps: {
        inline: [
          "@lilia/ui",
          "@lilia/theme",
          "@lilia/ui-contract",
          "@lilia/ui-foundation",
        ],
      },
    },
  },
});
