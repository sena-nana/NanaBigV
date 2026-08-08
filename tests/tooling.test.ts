import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { checkToolchain } from "../scripts/check-toolchain.ts";

function scriptEnv(extra: Record<string, string>) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === "npm_config_user_agent") {
      delete env[key];
    }
  }
  return {
    ...env,
    ...extra,
  };
}

function appConfig() {
  return JSON.parse(readFileSync(resolve("app.config.json"), "utf-8")) as {
    appName: string;
    productTitle: string;
    version: string;
    identifier: string;
    storageKeyPrefix: string;
    ui?: {
      preset?: string;
      density?: string;
      accent?: string;
    };
    shell: {
      homeTitle: string;
      workspaceSectionTitle: string;
      statusLabel: string;
      statusTitle: string;
    };
  };
}

describe("单应用模板工具链", () => {
  it("根 package.json 提供 Lilia 工具链脚本，不包含 workspace", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));

    expect(pkg.workspaces).toBeUndefined();
    expect(pkg.packageManager).toMatch(/^yarn@4\.17\.1\+sha512\./);
    expect(pkg.scripts).toMatchObject({
      "sync:app-config": "lilia-tools sync-app-config",
      "version:bump": "lilia-tools version-bump",
      dev: "lilia-build dev",
      build: "lilia-build build && node scripts/check-ui-bundle.mjs",
      pretest: "lilia-build prepare",
      test: "lilia-build test",
      "docs:dev": "lilia-build docs dev",
      "docs:build": "lilia-build docs build",
      "tauri:dev": "lilia-build tauri-dev",
      "tauri:build": "lilia-build tauri-build",
      "liliaui:status": "yarn check:package-manager && node scripts/lilia-ui-deps.mjs status",
    });
    expect(pkg.scripts.verify).toContain("lilia-build verify");
  });

  it("依赖 LiliaUI 官方 Layer 与 BigV 业务依赖，不包含 agent SDK", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    expect(deps.vue).toBeDefined();
    expect(deps["vue-router"]).toBeDefined();
    expect(deps["@lilia/ui"]).toBeDefined();
    expect(deps["@lilia/build"]).toBeDefined();
    expect(deps["@lilia/theme"]).toBeDefined();
    expect(deps["@tauri-apps/api"]).toBeDefined();
    expect(deps["@tauri-apps/plugin-store"]).toBeDefined();
    expect(deps["chart.js"]).toBeDefined();
    expect(deps["@anthropic-ai/claude-agent-sdk"]).toBeUndefined();
    expect(deps["@openai/codex-sdk"]).toBeUndefined();
    expect(deps["@modelcontextprotocol/sdk"]).toBeUndefined();
    expect(deps["@lilia/contracts"]).toBeUndefined();
    expect(deps.zod).toBeUndefined();
  });

  it("Rust 端使用 store、lilia plugin 和 reqwest Provider HTTP 调用", () => {
    const cargo = readFileSync(resolve("src-tauri/Cargo.toml"), "utf-8");

    expect(cargo).toContain('tauri-plugin-store = "2"');
    expect(cargo).toContain("tauri-plugin-lilia");
    expect(cargo).toContain('reqwest = { version = "0.12"');
    expect(cargo).not.toContain("rusqlite");
    expect(cargo).not.toContain("r2d2");
  });

  it("工具链检查要求 Node 26 和项目锁定的 Yarn 版本", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8")) as {
      packageManager: string;
    };
    expect(checkToolchain({
      nodeVersion: "26.5.0",
      packageManager: pkg.packageManager,
      userAgent: "yarn/4.17.1 npm/? node/26.5.0",
    })).toEqual([]);
    expect(checkToolchain({
      nodeVersion: "25.8.1",
      packageManager: pkg.packageManager,
      userAgent: "yarn/4.16.0 npm/? node/25.8.1",
    })).toHaveLength(2);

    const ok = spawnSync("node", ["scripts/check-toolchain.ts"], {
      cwd: resolve("."),
      env: scriptEnv({
        npm_config_user_agent: "yarn/4.17.1 npm/? node/26.5.0",
      }),
      encoding: "utf-8",
    });
    expect(ok.status).toBe(0);

    const bad = spawnSync("node", ["scripts/check-toolchain.ts"], {
      cwd: resolve("."),
      env: scriptEnv({
        npm_config_user_agent: "npm/11.0.0 node/?",
      }),
      encoding: "utf-8",
    });
    expect(bad.status).toBe(1);
  });

  it("应用元数据、装配入口与 Lilia facade 对齐", () => {
    const config = appConfig();
    const tauri = JSON.parse(readFileSync(resolve("src-tauri/tauri.conf.json"), "utf-8"));
    const cargo = readFileSync(resolve("src-tauri/Cargo.toml"), "utf-8");
    const appShell = readFileSync(resolve("src/config/appShell.ts"), "utf-8");
    const activeShell = readFileSync(resolve("src/ui/ActiveShell.vue"), "utf-8");
    const activePreset = readFileSync(resolve("src/ui/activePreset.ts"), "utf-8");
    const main = readFileSync(resolve("src/main.ts"), "utf-8");
    const indexHtml = readFileSync(resolve("index.html"), "utf-8");
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));

    expect(config.ui?.preset).toBe("lilia");
    expect(tauri.productName).toBe(config.productTitle);
    expect(tauri.version).toBe(config.version);
    expect(tauri.identifier).toBe(config.identifier);
    expect(tauri.app.windows[0].title).toBe(config.productTitle);
    expect(cargo).toContain(`version = "${config.version}"`);
    expect(appShell).toContain('import appConfig from "../../app.config.json"');
    expect(appShell).toContain("SIDEBAR_NAV");
    expect(appShell).toContain("BIGV_WORKBENCH_SNAPSHOT.nav.map");
    expect(activeShell).toContain('aria-label="主导航"');
    expect(activeShell).toContain("LiliaAppShell");
    expect(activePreset).toContain("setLiliaUiConfig");
    expect(activePreset).toContain("provideSettings");
    expect(main).toContain('import "./ui/styles.css"');
    expect(main).toContain("createBigVApp");
    expect(indexHtml).toContain("%APP_PRODUCT_TITLE%");
    expect(indexHtml).toContain("%APP_STORAGE_KEY_PREFIX%.theme");
    expect(pkg.dependencies["@lilia/ui"]).toContain("github:sena-nana/LiliaUI");
  });

  it("GitHub Issue 模板不包含 Lilia 业务字段", () => {
    const bug = readFileSync(resolve(".github/ISSUE_TEMPLATE/bug_report.yml"), "utf-8");
    const feature = readFileSync(
      resolve(".github/ISSUE_TEMPLATE/feature_request.yml"),
      "utf-8",
    );
    const combined = `${bug}\n${feature}`;

    expect(combined).toContain("模板版本 / commit");
    expect(combined).toContain("构建 / 发布");
    expect(combined).not.toContain("Lilia 版本");
    expect(combined).not.toContain("Backend");
    expect(combined).not.toContain("Agent");
    expect(combined).not.toContain("Memory");
    expect(combined).not.toContain("Roadmap");
  });
});

describe("LiliaUI 接入契约", () => {
  it("本地样式入口转发官方 Layer", () => {
    const styles = readFileSync(resolve("src/ui/styles.css"), "utf-8");
    expect(styles).toContain('@import "@lilia/ui/styles.css"');
  });

  it("应用装配层与 preset facade 就绪", () => {
    const app = readFileSync(resolve("src/app.ts"), "utf-8");
    const preset = readFileSync(resolve("src/ui/preset.ts"), "utf-8");
    const profile = readFileSync(resolve("lilia.tools.profile.mjs"), "utf-8");

    expect(app).toContain("createBigVApp");
    expect(app).toContain('from "@lilia/ui/commands"');
    expect(preset).toContain('appUIPresetId = "lilia"');
    expect(preset).toContain("activeUIPreset");
    expect(profile).toContain("@lilia/ui");
    expect(profile).toContain("src/ui/preset.ts");
  });

  it("侧栏导航来自 workbench 快照", () => {
    const appShell = readFileSync(resolve("src/config/appShell.ts"), "utf-8");
    const activeShell = readFileSync(resolve("src/ui/ActiveShell.vue"), "utf-8");

    expect(appShell).toContain("SIDEBAR_NAV");
    expect(activeShell).toContain("SIDEBAR_NAV");
    expect(activeShell).toContain("LiliaSidebarNavRow");
    expect(activeShell).not.toContain("sb-brand__title");
  });
});
