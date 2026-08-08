import { defineToolsProfile } from "@lilia/tools";

export default defineToolsProfile({
  requireSingleAppRoot: true,
  expectedDependencies: [
    "@lilia/build",
    "@lilia/config",
    "@lilia/theme",
    "@lilia/tools",
    "@lilia/ui",
    "@lilia/ui-contract",
    "@lilia/ui-foundation",
    "vue",
    "vue-router",
  ],
  nativeBackdropPermissions: [
    "lilia:default",
    "lilia:allow-set-window-backdrop",
  ],
  importantFiles: [
    ["app.config.json", "application metadata source"],
    ["src/main.ts", "Vue mount entry"],
    ["src/AppRoot.vue", "application-owned root and global hosts"],
    ["src/app.ts", "Vue, Router, Shell, commands, and provider assembly"],
    ["src/ui/preset.ts", "active preset adapter"],
    ["src/ui/ActiveShell.vue", "application shell"],
    ["src/pages/Workspace.vue", "default application page"],
    ["tests/app.test.ts", "application assembly test"],
    ["tests/tooling.test.ts", "application tooling contract tests"],
    ["docs/guide/development.md", "development workflow"],
  ],
  agentTargetFiles: {
    "src/pages/Workspace.vue": [
      ["workspace.page"],
    ],
  },
  boundaries: {
    includes: [
      "application bootstrap and routing",
      "application configuration and commands",
      "application-owned features and Tauri boundaries",
      "live assist workbench business logic",
    ],
    excludes: [
      "shared UI and shell implementations",
      "shared build and tooling engines",
      "shared Tauri window runtime",
    ],
  },
  entrypoints: [
    { id: "dev", command: "yarn dev", purpose: "start the frontend development server" },
    { id: "agent-debug", command: "yarn agent:debug --json", purpose: "inspect application readiness" },
    { id: "test", command: "yarn test", purpose: "run application behavior tests" },
    { id: "verify", command: "yarn verify", purpose: "run the complete application verification" },
  ],
});
