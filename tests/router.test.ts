import { fireEvent, render, screen } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { describe, expect, it } from "vitest";
import App from "../src/App.vue";
import { APP_SHELL_COPY } from "../src/config/appShell";
import { createTemplateRouter } from "../src/router";

async function renderAt(path: string) {
  const router = createTemplateRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();

  render(App, {
    global: {
      plugins: [router],
    },
  });
}

describe("基础路由", () => {
  it("默认首页显示模板占位内容", async () => {
    await renderAt("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: APP_SHELL_COPY.homeTitle }),
    ).toBeInTheDocument();
  });

  it("侧边栏左下角提供设置、扩展和状态入口", async () => {
    await renderAt("/");

    expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "扩展" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: APP_SHELL_COPY.statusTitle }),
    ).toHaveClass("sb-conn--ok");
  });

  it("设置页默认显示外观设置并使用设置侧栏", async () => {
    await renderAt("/settings");

    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "设置分类" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /外观/ })).toHaveClass("is-active");
    expect(await screen.findByRole("radiogroup", { name: "圆角" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "圆角半径" })).toBeInTheDocument();
    expect(screen.queryByText(/Claude|Codex|CC-Switch|agent/i)).toBeNull();
  });

  it("外观页圆角设置可即时切换全局 data-corners", async () => {
    await renderAt("/settings");

    const smooth = await screen.findByRole("radio", { name: /平滑/ });
    const round = screen.getByRole("radio", { name: /普通/ });

    expect(smooth).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("smooth");

    await fireEvent.click(round);

    expect(round).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("round");

    await fireEvent.click(smooth);

    expect(smooth).toHaveClass("is-active");
    expect(document.documentElement.dataset.corners).toBe("smooth");
  });

  it("外观页圆角半径设置可即时切换全局半径变量", async () => {
    await renderAt("/settings");

    const radius = await screen.findByRole("slider", { name: "圆角半径" });

    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("8px");
    expect(screen.getByText("8px")).toBeInTheDocument();

    await fireEvent.input(radius, { target: { value: "14" } });

    expect(document.documentElement.style.getPropertyValue("--app-corner-radius")).toBe("14px");
    expect(screen.getByText("14px")).toBeInTheDocument();
  });

  it("设置页可通过 tab query 显示关于页，未知 tab 回落外观", async () => {
    await renderAt("/settings?tab=about");

    expect(await screen.findByRole("heading", { level: 1, name: "关于" })).toBeInTheDocument();
    expect(await screen.findByText("Tauri 2 + Vue 3")).toBeInTheDocument();
  });

  it("扩展页显示模板占位内容", async () => {
    await renderAt("/plugins");

    expect(await screen.findByRole("heading", { level: 1, name: "扩展" })).toBeInTheDocument();
    expect(screen.getByText("当前模板不包含 Lilia 的真实插件管理逻辑。")).toBeInTheDocument();
  });

  it("未知路由回到首页", async () => {
    await renderAt("/missing");

    expect(await screen.findByText(APP_SHELL_COPY.homeDescription)).toBeInTheDocument();
  });

  it("未知设置 tab 回落到外观", async () => {
    await renderAt("/settings?tab=missing");

    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
  });
});
