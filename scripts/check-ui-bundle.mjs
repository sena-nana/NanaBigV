import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const report = JSON.parse(readFileSync(resolve("dist/ui-bundle-report.json"), "utf8"));
const baselines = JSON.parse(readFileSync(resolve("tests/bundle-baseline.json"), "utf8"));
const baseline = baselines[report.preset];
if (!baseline) throw new Error(`Missing bundle baseline for ${report.preset}.`);

for (const metric of ["js", "css"]) {
  const allowed = Math.ceil(baseline.bytes[metric] * (1 + baseline.allowedGrowth));
  if (report.bytes[metric] > allowed) {
    throw new Error(`${report.preset} ${metric} bundle is ${report.bytes[metric]} bytes; allowed ${allowed}.`);
  }
}
if (report.dynamicEntries.length < baseline.minimumDynamicEntries) {
  throw new Error(
    `${report.preset} emitted ${report.dynamicEntries.length} async chunks; expected at least ${baseline.minimumDynamicEntries}.`,
  );
}
console.log(`Verified ${report.preset} single-Layer bundle and ${report.dynamicEntries.length} async chunks.`);
