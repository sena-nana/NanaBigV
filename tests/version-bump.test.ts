import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calculateNextVersion } from "../scripts/version-bump.mjs";

describe("版本号提升工具", () => {
  it("支持 patch/minor/major 递增", () => {
    expect(calculateNextVersion("0.1.0", "patch")).toBe("0.1.1");
    expect(calculateNextVersion("0.1.9", "minor")).toBe("0.2.0");
    expect(calculateNextVersion("0.9.9", "major")).toBe("1.0.0");
  });

  it("支持显式版本并拒绝不合法或回退版本", () => {
    expect(calculateNextVersion("1.2.3", "1.2.4")).toBe("1.2.4");
    expect(() => calculateNextVersion("1.2.3", "1.2.2")).toThrow(
      /not greater than current/i,
    );
    expect(() => calculateNextVersion("1.2.3", "bad.version")).toThrow(/Invalid semantic version/i);
  });

  it("版本提升脚本已注册到 package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf-8"));

    expect(pkg.scripts["version:bump"]).toBe("node scripts/version-bump.mjs");
  });
});
