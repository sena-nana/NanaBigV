import { invoke } from "@tauri-apps/api/core";
import type {
  ContextEventInput,
  ContextWindowSnapshot,
} from "./types";

export async function loadContextWindow(): Promise<ContextWindowSnapshot> {
  return invoke<ContextWindowSnapshot>("load_context_window");
}

export async function submitContextEvent(
  event: ContextEventInput,
): Promise<ContextWindowSnapshot> {
  return invoke<ContextWindowSnapshot>("submit_context_event", { event });
}

export async function clearContextWindow(): Promise<ContextWindowSnapshot> {
  return invoke<ContextWindowSnapshot>("clear_context_window");
}
