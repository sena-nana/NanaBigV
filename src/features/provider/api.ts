import { invoke } from "@tauri-apps/api/core";
import type { ProviderConfig, ProviderProbeResult } from "./types";

export async function loadProviderConfig(): Promise<ProviderConfig> {
  return invoke<ProviderConfig>("load_provider_config");
}

export async function saveProviderConfig(
  config: ProviderConfig,
): Promise<ProviderConfig> {
  return invoke<ProviderConfig>("save_provider_config", { config });
}

export async function testProviderConnection(): Promise<ProviderProbeResult> {
  return invoke<ProviderProbeResult>("test_provider_connection");
}
