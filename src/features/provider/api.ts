import { invoke } from "@tauri-apps/api/core";
import type {
  ProviderConfig,
  ProviderJsonGenerationResult,
  ProviderModelListResult,
  ProviderProbeResult,
} from "./types";

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

export async function listProviderModels(
  config: ProviderConfig,
): Promise<ProviderModelListResult> {
  return invoke<ProviderModelListResult>("list_provider_models", { config });
}

export async function generateProviderJson(
  prompt: string,
): Promise<ProviderJsonGenerationResult> {
  return invoke<ProviderJsonGenerationResult>("generate_provider_json", { prompt });
}
