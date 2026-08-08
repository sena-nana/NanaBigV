import { defineComponent } from "vue";
import { fireEvent, render } from "@testing-library/vue";
import { beforeEach, describe, expect, it } from "vitest";
import {
  usePersistentBoolean,
  usePersistentNumber,
  usePersistentString,
} from "../src/composables/usePersistentState";

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

