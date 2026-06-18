#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readJson, syncFromAppConfig, validateAppConfig } from "./app-config-sync.mjs";

const packageUrl = new URL("../package.json", import.meta.url);
const root = packageUrl.protocol === "file:"
  ? dirname(fileURLToPath(packageUrl))
  : process.cwd();
const configPath = resolve(root, "app.config.json");
const appConfig = readJson(configPath);

validateAppConfig(appConfig);
syncFromAppConfig(appConfig, root);
