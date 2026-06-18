#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readJson, syncFromAppConfig, validateAppConfig } from "./app-config-sync.mjs";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const configPath = resolve(root, "app.config.json");
const appConfig = readJson(configPath);

validateAppConfig(appConfig);
syncFromAppConfig(appConfig, root);
