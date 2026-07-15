#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export interface ToolchainInput {
  nodeVersion: string;
  packageManager: string;
  userAgent: string;
}

export function checkToolchain({
  nodeVersion,
  packageManager,
  userAgent,
}: ToolchainInput): string[] {
  const issues: string[] = [];
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "", 10);
  if (nodeMajor !== 26) {
    issues.push(`Expected Node.js 26.x, detected ${nodeVersion || "an unknown version"}.`);
  }

  const expectedYarn = /^yarn@([^+]+)/.exec(packageManager)?.[1];
  const detectedYarn = /\byarn\/([^\s]+)/.exec(userAgent)?.[1];
  if (!expectedYarn) {
    issues.push(`Invalid packageManager declaration: ${packageManager || "missing"}.`);
  } else if (detectedYarn !== expectedYarn) {
    issues.push(`Expected Yarn ${expectedYarn}, detected ${detectedYarn ?? "a non-Yarn entrypoint"}.`);
  }

  return issues;
}

if (isMainModule()) {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { packageManager?: string };
  const appConfig = JSON.parse(
    readFileSync(new URL("../app.config.json", import.meta.url), "utf8"),
  ) as { productTitle?: string };
  const issues = checkToolchain({
    nodeVersion: process.versions.node,
    packageManager: packageJson.packageManager ?? "",
    userAgent: process.env.npm_config_user_agent ?? "",
  });

  if (issues.length > 0) {
    console.error([
      `${appConfig.productTitle ?? "NaNaBigV"} requires Node.js 26 and the pinned Yarn release.`,
      ...issues,
      "Install Corepack with `npm install --global corepack@0.35.0`, then run through `corepack yarn`.",
    ].join("\n"));
    process.exitCode = 1;
  }
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return Boolean(entryPath) && pathToFileURL(resolve(entryPath)).href === import.meta.url;
}
