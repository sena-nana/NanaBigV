#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readJson,
  syncFromAppConfig,
  validateAppConfig,
  writeIfChanged,
} from "./app-config-sync.mjs";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const appConfigPath = resolve(root, "app.config.json");
const trackedFiles = [
  appConfigPath,
  resolve(root, "package.json"),
  {
    path: resolve(root, "src-tauri/tauri.conf.json"),
  },
  resolve(root, "src-tauri/Cargo.toml"),
].map((path) => ({
  path,
  read: () => readFileSync(path, "utf8"),
}));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    run();
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Version bump failed.");
    }
    process.exit(1);
  }
}

export function run() {
  const request = process.argv[2];
  if (!request || request === "-h" || request === "--help") {
    throwUsage();
    return;
  }

  const appConfig = readJson(appConfigPath);
  validateAppConfig(appConfig);

  const nextVersion = calculateNextVersion(appConfig.version, request);
  const backup = trackedFiles.map((file) => [file.path, file.read()]);
  // keep all changed files in one rollback step if sync failed
  try {
    writeIfChanged(
      appConfigPath,
      JSON.stringify({ ...appConfig, version: nextVersion }, null, 2) + "\n",
    );
    syncFromAppConfig({ ...appConfig, version: nextVersion }, root);
    console.log(`Updated version: ${appConfig.version} -> ${nextVersion}`);
    return nextVersion;
  } catch (error) {
    for (const [path, content] of backup) {
      writeIfChanged(path, content);
    }
    if (error instanceof Error) {
      throw new Error(`Version bump failed: ${error.message}`);
    }
    throw error;
  }
}

export function calculateNextVersion(currentVersion, requestedVersion) {
  const current = parseVersion(currentVersion);
  if (requestedVersion === "patch" || requestedVersion === "minor" || requestedVersion === "major") {
    return bump(current, requestedVersion);
  }

  const target = parseVersion(requestedVersion);
  if (!target) {
    throw new Error(`Invalid semantic version: ${requestedVersion}`);
  }
  if (!greaterThan(target, current)) {
    throw new Error(
      `The requested version ${requestedVersion} is not greater than current ${current.version}.`,
    );
  }
  return target.version;
}

function bump(current, type) {
  const { major, minor, patch } = current;
  if (type === "patch") return `${major}.${minor}.${patch + 1}`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  if (type === "major") return `${major + 1}.0.0`;
  throw new Error(`Unsupported bump level: ${type}`);
}

function parseVersion(version) {
  const match = version?.match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    version: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function greaterThan(a, b) {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch > b.patch;
}

function throwUsage() {
  console.error("Usage: yarn version:bump <patch|minor|major|<x.y.z>>");
  process.exit(1);
}
