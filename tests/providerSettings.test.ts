import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProviderSection from "../src/pages/settings/ProviderSection.vue";
import {
  resetProviderSettingsStateForTest,
  useProviderStatusSummary,
} from "../src/composables/useProviderSettings";
import type {
  ProviderConfig,
  ProviderProbeResult,
} from "../src/features/provider/types";

const loadedConfig: ProviderConfig = {
  baseUrl: "https://example.com/v1",
  apiKey: "sk-local-test",
  model: "gpt-4.1-mini",
};

const mockInvoke = vi.fn<
  (command: string, payload?: Record<string, unknown>) => Promise<unknown>
>();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (command: string, payload?: Record<string, unknown>) =>
    mockInvoke(command, payload),
}));

function successProbe(): ProviderProbeResult {
  return {
    ok: true,
    latencyMs: 182,
    model: loadedConfig.model,
    message: "Provider 连通性测试通过",
  };
}

function failureProbe(): ProviderProbeResult {
  return {
    ok: false,
    error: {
      kind: "http_status",
      message: "provider 返回 HTTP 401",
      statusCode: 401,
      responseBodySnippet: "{\"error\":\"invalid_api_key\"}",
    },
  };
}

function modelList() {
  return {
    ok: true,
    models: ["gpt-4.1", loadedConfig.model],
  };
}

function installInvokeMock(overrides: Partial<Record<string, unknown>> = {}) {
  mockInvoke.mockImplementation(async (command, payload) => {
    if (command in overrides) {
      const value = overrides[command];
      if (value instanceof Error) throw value;
      return value;
    }
    if (command === "load_provider_config") return loadedConfig;
    if (command === "save_provider_config") return payload?.config ?? loadedConfig;
    if (command === "list_provider_models") return modelList();
    if (command === "test_provider_connection") return successProbe();
    throw new Error(`unexpected command: ${command}`);
  });
}

describe("Provider settings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetProviderSettingsStateForTest();
    mockInvoke.mockReset();
    installInvokeMock();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("首次加载会读取 Provider 配置并获取远端模型", async () => {
    render(ProviderSection);

    expect(await screen.findByDisplayValue(loadedConfig.baseUrl)).toBeInTheDocument();
    expect(await screen.findByDisplayValue(loadedConfig.model)).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith("load_provider_config", undefined);
    expect(mockInvoke).toHaveBeenCalledWith("list_provider_models", {
      config: loadedConfig,
    });
    expect(screen.getByRole("heading", { name: "模型配置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "获取模型" })).toBeInTheDocument();
  });

  it("模型选择后会自动保存配置", async () => {
    render(ProviderSection);

    await screen.findByDisplayValue(loadedConfig.model);
    const modelSelect = screen.getByLabelText("模型");
    await fireEvent.update(modelSelect, "gpt-4.1");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();

    expect(mockInvoke).toHaveBeenCalledWith("save_provider_config", {
      config: expect.objectContaining({ model: "gpt-4.1" }),
    });
  });

  it("保存按钮会立即保存当前配置", async () => {
    render(ProviderSection);

    await screen.findByDisplayValue(loadedConfig.model);
    await fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(mockInvoke).toHaveBeenCalledWith("save_provider_config", {
      config: loadedConfig,
    });
  });

  it("本地保存失败时会显示明确错误", async () => {
    installInvokeMock({
      save_provider_config: new Error("disk full"),
    });
    render(ProviderSection);

    await screen.findByDisplayValue(loadedConfig.model);
    const modelSelect = screen.getByLabelText("模型");
    await fireEvent.update(modelSelect, "gpt-4.1");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();

    expect(await screen.findByText("本地保存失败：disk full")).toBeInTheDocument();
  });

  it("测试按钮在成功时展示明确结果", async () => {
    render(ProviderSection);

    await screen.findByDisplayValue(loadedConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Provider 连通性测试通过",
    );
    expect(screen.getByText(`模型：${loadedConfig.model}`)).toBeInTheDocument();
    expect(screen.getByText("耗时：182 ms")).toBeInTheDocument();
    expect(mockInvoke).toHaveBeenCalledWith("test_provider_connection", undefined);
    expect(useProviderStatusSummary().providerStatusSummary.value.label).toBe("可用");
    expect(useProviderStatusSummary().providerStatusSummary.value.latencyLabel).toBe("182ms");
  });

  it("测试按钮在失败时展示错误类型和消息", async () => {
    installInvokeMock({
      test_provider_connection: failureProbe(),
    });
    render(ProviderSection);

    await screen.findByDisplayValue(loadedConfig.baseUrl);
    await fireEvent.click(screen.getByRole("button", { name: "测试连通性" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("http_status");
    expect(screen.getByText("provider 返回 HTTP 401")).toBeInTheDocument();
    expect(screen.getByText("HTTP 401")).toBeInTheDocument();
    expect(useProviderStatusSummary().providerStatusSummary.value.label).toBe("异常");
    expect(useProviderStatusSummary().providerStatusSummary.value.detail).toBe("provider 返回 HTTP 401");
  });
});
