import { fireEvent, render, screen } from "@testing-library/vue";
import { createMemoryHistory } from "vue-router";
import { describe, expect, it } from "vitest";
import App from "../src/App.vue";
import { APP_METADATA, APP_SHELL_COPY } from "../src/config/appShell";
import { createBigVRouter } from "../src/router";

async function renderAt(path: string) {
  const router = createBigVRouter(createMemoryHistory());
  await router.push(path);
  await router.isReady();

  render(App, {
    global: {
      plugins: [router],
    },
  });
}

describe("基础路由", () => {
  it("默认首页跳转到弹幕姬工作台", async () => {
    await renderAt("/");

    expect(
      await screen.findByRole("heading", { level: 1, name: APP_SHELL_COPY.homeTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "实时互动流" })).toBeInTheDocument();
  });

  it("侧边栏显示四个功能标签，底部保留设置和状态入口", async () => {
    await renderAt("/");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "弹幕姬" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "额度检查" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "观众信息" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "直播回顾" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "设置" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "新建" })).toBeNull();
    expect(screen.queryByRole("button", { name: "搜索" })).toBeNull();
    expect(screen.queryByRole("button", { name: "添加" })).toBeNull();
    expect(screen.queryByRole("link", { name: "扩展" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "模拟状态：自动投递运行中" }),
    ).toHaveClass("sb-conn--ok");
    expect(screen.getByText("运行")).toBeInTheDocument();
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

  it("弹幕姬页开关只切换本地状态", async () => {
    await renderAt("/danmaku");

    const toggle = await screen.findByRole("switch", { name: "自动投递" });

    expect(toggle).toHaveAttribute("aria-checked", "true");
    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("本地暂停投递")).toBeInTheDocument();
    expect(screen.getByText("自动投递已暂停")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "模拟状态：自动投递已暂停" })).toHaveClass("sb-conn--warn");
    expect(screen.getByText("暂停")).toBeInTheDocument();
    expect(localStorage.getItem("bigv.workbench")).toContain("\"key\":\"dispatch\"");
    expect(localStorage.getItem("bigv.workbench")).toContain("\"enabled\":false");
  });

  it("额度检查页支持切换时间窗", async () => {
    await renderAt("/quota");

    expect(await screen.findByText("24 小时趋势")).toBeInTheDocument();
    expect(screen.getByText("请求")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "7 天" }));

    expect(await screen.findByText("7 天趋势")).toBeInTheDocument();
  });

  it("额度检查页会恢复上次选择的时间窗", async () => {
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.quotaWindow`, "30d");

    await renderAt("/quota");

    expect(await screen.findByText("30 天趋势")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 天" })).toHaveAttribute("aria-pressed", "true");
  });

  it("观众信息页支持切换选中观众并按筛选自动同步详情", async () => {
    await renderAt("/audience");

    expect(await screen.findByRole("heading", { level: 2, name: "阿黎" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /北街舟/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "北街舟" })).toBeInTheDocument();

    await fireEvent.change(screen.getByRole("combobox", { name: "关系类型筛选" }), {
      target: { value: "new" },
    });

    expect(await screen.findByRole("heading", { level: 2, name: "糖霜六号" })).toBeInTheDocument();
  });

  it("观众信息页会恢复筛选条件和上次选中的观众", async () => {
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceActivityFilter`, "medium");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceSpendingFilter`, "low");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.audienceRelationshipFilter`, "regular");
    localStorage.setItem(`${APP_METADATA.storageKeyPrefix}.selectedAudienceId`, "jing-dao");

    await renderAt("/audience");

    expect(((await screen.findByRole("combobox", { name: "活跃度筛选" })) as HTMLSelectElement).value).toBe("medium");
    expect((screen.getByRole("combobox", { name: "消费倾向筛选" }) as HTMLSelectElement).value).toBe("low");
    expect((screen.getByRole("combobox", { name: "关系类型筛选" }) as HTMLSelectElement).value).toBe("regular");
    expect(await screen.findByRole("heading", { level: 2, name: "镜岛" })).toBeInTheDocument();
  });

  it("直播回顾页显示主播快照和建议", async () => {
    await renderAt("/review");

    expect(await screen.findByText("主播：青栀")).toBeInTheDocument();
    expect(screen.getByText("把调试段落拆成“目标 -> 过程 -> 结论”三段")).toBeInTheDocument();
  });

  it("未知路由回到弹幕姬", async () => {
    await renderAt("/missing");

    expect(await screen.findByRole("heading", { level: 2, name: "实时互动流" })).toBeInTheDocument();
  });

  it("未知设置 tab 回落到外观", async () => {
    await renderAt("/settings?tab=missing");

    expect(await screen.findByRole("heading", { level: 1, name: "外观" })).toBeInTheDocument();
  });
});
