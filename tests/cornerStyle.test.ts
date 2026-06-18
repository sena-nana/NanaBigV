import { describe, expect, it, vi } from "vitest";
import appConfig from "../app.config.json";

const cornerStorageKey = `${appConfig.storageKeyPrefix}.corners`;
const cornerRadiusStorageKey = `${appConfig.storageKeyPrefix}.cornerRadius`;

describe("useCornerStyle", () => {
  it("默认启用平滑圆角和 8px 半径并写入 html 与 localStorage", async () => {
    vi.resetModules();

    const { useCornerStyle } = await import("../src/composables/useCornerStyle");
    const { cornerRadius, cornerStyle } = useCornerStyle();

    expect(cornerStyle.value).toBe("smooth");
    expect(cornerRadius.value).toBe(8);
    expect(document.documentElement.dataset.corners).toBe("smooth");
    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("8px");
    expect(localStorage.getItem(cornerStorageKey)).toBe("smooth");
    expect(localStorage.getItem(cornerRadiusStorageKey)).toBe("8");
  });

  it("从 localStorage 恢复普通圆角和半径并写入 html", async () => {
    localStorage.setItem(cornerStorageKey, "round");
    localStorage.setItem(cornerRadiusStorageKey, "14");
    vi.resetModules();

    const { useCornerStyle } = await import("../src/composables/useCornerStyle");
    const { cornerRadius, cornerStyle } = useCornerStyle();

    expect(cornerStyle.value).toBe("round");
    expect(cornerRadius.value).toBe(14);
    expect(document.documentElement.dataset.corners).toBe("round");
    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("14px");
  });

  it("setCornerStyle 和 setCornerRadius 会同步更新 html 与 localStorage", async () => {
    vi.resetModules();
    const { useCornerStyle } = await import("../src/composables/useCornerStyle");
    const { cornerRadius, cornerStyle, setCornerRadius, setCornerStyle } = useCornerStyle();

    setCornerStyle("round");
    setCornerRadius(12);

    expect(cornerStyle.value).toBe("round");
    expect(cornerRadius.value).toBe(12);
    expect(document.documentElement.dataset.corners).toBe("round");
    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("12px");
    expect(localStorage.getItem(cornerStorageKey)).toBe("round");
    expect(localStorage.getItem(cornerRadiusStorageKey)).toBe("12");
  });

  it("圆角半径会限制在可用范围内", async () => {
    vi.resetModules();
    const { useCornerStyle } = await import("../src/composables/useCornerStyle");
    const { cornerRadius, setCornerRadius } = useCornerStyle();

    setCornerRadius(999);
    expect(cornerRadius.value).toBe(20);

    setCornerRadius(-1);
    expect(cornerRadius.value).toBe(0);
  });
});
