import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeIfChanged(path, next) {
  const current = readFileSync(path, "utf8");
  if (current !== next) {
    writeFileSync(path, next, "utf8");
  }
}

export function syncFromAppConfig(appConfig, projectRoot = root) {
  syncJson("package.json", (pkg) => {
    pkg.name = appConfig.appName;
    pkg.version = appConfig.version;
  }, projectRoot);

  syncJson("src-tauri/tauri.conf.json", (tauriConfig) => {
    tauriConfig.productName = appConfig.productTitle;
    tauriConfig.version = appConfig.version;
    tauriConfig.identifier = appConfig.identifier;
    tauriConfig.app.windows = tauriConfig.app.windows.map((windowConfig) => {
      if (windowConfig.label === "main") {
        return { ...windowConfig, title: appConfig.productTitle };
      }
      return windowConfig;
    });
  }, projectRoot);

  syncTomlValue("src-tauri/Cargo.toml", "version", appConfig.version, projectRoot);
}

export function validateAppConfig(config) {
  const required = ["appName", "productTitle", "version", "identifier", "storageKeyPrefix"];
  for (const key of required) {
    assertNonEmptyString(config[key], key);
  }

  const shellRequired = [
    "homeTitle",
    "homeDescription",
    "homeActionLabel",
    "workspaceSectionTitle",
    "workspaceName",
    "workspaceEmptyText",
    "statusLabel",
    "statusTitle",
    "settingsDescription",
  ];

  if (typeof config.shell !== "object" || config.shell === null) {
    throw new Error('app.config.json requires a "shell" object.');
  }
  for (const key of shellRequired) {
    assertNonEmptyString(config.shell[key], `shell.${key}`);
  }
}

function syncJson(relativePath, update, projectRoot) {
  const path = resolve(projectRoot, relativePath);
  const data = readJson(path);
  update(data);
  writeIfChanged(path, `${JSON.stringify(data, null, 2)}\n`);
}

function syncTomlValue(relativePath, key, value, projectRoot) {
  const path = resolve(projectRoot, relativePath);
  const escaped = value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const next = readFileSync(path, "utf-8").replace(
    new RegExp(`^${key}\\s*=\\s*"[^"]*"`, "m"),
    `${key} = "${escaped}"`,
  );
  writeIfChanged(path, next);
}

function assertNonEmptyString(value, keyPath) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`app.config.json requires a non-empty string "${keyPath}".`);
  }
}
