import { invoke } from "@tauri-apps/api/core";
import type { LiveAssistConfig } from "./types";

export async function loadLiveAssistConfig(): Promise<LiveAssistConfig> {
  return invoke<LiveAssistConfig>("load_live_assist_config");
}

export async function saveLiveAssistConfig(
  config: LiveAssistConfig,
): Promise<LiveAssistConfig> {
  return invoke<LiveAssistConfig>("save_live_assist_config", { config });
}
