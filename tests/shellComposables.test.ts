import { defineComponent, nextTick, ref } from "vue";
import { fireEvent, render } from "@testing-library/vue";
import { beforeEach, describe, expect, it } from "vitest";
import { SIDEBAR_CONFIG } from "../src/config/appShell";
import {
  usePersistentBoolean,
  usePersistentNumber,
  usePersistentString,
} from "../src/composables/usePersistentState";
import { useShellSidebar } from "../src/composables/useShellSidebar";

beforeEach(() => {
  localStorage.clear();
});

describe("persistent state composables", () => {
  it("持久化 boolean 使用 1/0 存储并支持默认值", async () => {
    const Probe = defineComponent({
      setup() {
        const enabled = usePersistentBoolean("test.boolean", true);
        return { enabled };
      },
      template: `<button @click="enabled = !enabled">{{ String(enabled) }}</button>`,
    });

    const view = render(Probe);
    expect(view.getByRole("button")).toHaveTextContent("true");

    await fireEvent.click(view.getByRole("button"));

    expect(view.getByRole("button")).toHaveTextContent("false");
    expect(localStorage.getItem("test.boolean")).toBe("0");
  });

  it("持久化 number 会读取、clamp 并写回", async () => {
    localStorage.setItem("test.number", "999");
    const Probe = defineComponent({
      setup() {
        const size = usePersistentNumber({
          key: "test.number",
          defaultValue: 12,
          min: 4,
          max: 20,
        });
        return { size };
      },
      template: `<button @click="size = 2">{{ size }}</button>`,
    });

    const view = render(Probe);
    expect(view.getByRole("button")).toHaveTextContent("20");

    await fireEvent.click(view.getByRole("button"));

    expect(view.getByRole("button")).toHaveTextContent("4");
    expect(localStorage.getItem("test.number")).toBe("4");
  });

  it("持久化 string 会校验允许值并写回", async () => {
    localStorage.setItem("test.string", "invalid");
    const Probe = defineComponent({
      setup() {
        const mode = usePersistentString({
          key: "test.string",
          defaultValue: "a",
          allowedValues: ["a", "b", "c"] as const,
        });
        return { mode };
      },
      template: `<button @click="mode = 'c'">{{ mode }}</button>`,
    });

    const view = render(Probe);
    expect(view.getByRole("button")).toHaveTextContent("a");

    await fireEvent.click(view.getByRole("button"));

    expect(view.getByRole("button")).toHaveTextContent("c");
    expect(localStorage.getItem("test.string")).toBe("c");
  });
});

describe("shell sidebar composable", () => {
  it("组合宽度、折叠状态和 disabled 规则", async () => {
    localStorage.setItem(SIDEBAR_CONFIG.widthStorageKey, "260");
    const Probe = defineComponent({
      setup() {
        const locked = ref(false);
        const sidebar = useShellSidebar(locked);
        return { locked, sidebar };
      },
      template: `
        <div>
          <button aria-label="toggle" @click="sidebar.toggleCollapsed" />
          <button aria-label="lock" @click="locked = !locked" />
          <span data-testid="collapsed">{{ String(sidebar.effectiveCollapsed.value) }}</span>
          <span data-testid="width">{{ sidebar.widthStyle.value }}</span>
          <span data-testid="min">{{ sidebar.minWidth }}</span>
          <span data-testid="max">{{ sidebar.maxWidth }}</span>
        </div>
      `,
    });

    const view = render(Probe);
    expect(view.getByTestId("width")).toHaveTextContent("260px");
    expect(view.getByTestId("min")).toHaveTextContent("180");
    expect(view.getByTestId("max")).toHaveTextContent("480");

    await fireEvent.click(view.getByRole("button", { name: "toggle" }));
    await nextTick();

    expect(view.getByTestId("collapsed")).toHaveTextContent("true");
    expect(view.getByTestId("width")).toHaveTextContent("0px");
    expect(localStorage.getItem(SIDEBAR_CONFIG.collapsedStorageKey)).toBe("1");

    await fireEvent.click(view.getByRole("button", { name: "lock" }));
    await nextTick();

    expect(view.getByTestId("collapsed")).toHaveTextContent("false");
    expect(view.getByTestId("width")).toHaveTextContent("260px");
  });
});
