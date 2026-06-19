import { invoke } from "@tauri-apps/api/core";
import type {
  MemoryRetrieveRequest,
  MemoryRetrieveResult,
  MemoryStoreSnapshot,
  MemoryWriteInput,
  MemoryWriteResult,
} from "./types";

export async function loadMemorySnapshot(): Promise<MemoryStoreSnapshot> {
  return invoke<MemoryStoreSnapshot>("load_memory_snapshot");
}

export async function retrieveMemory(
  request: MemoryRetrieveRequest,
): Promise<MemoryRetrieveResult> {
  return invoke<MemoryRetrieveResult>("retrieve_memory", { request });
}

export async function submitMemoryWrite(
  input: MemoryWriteInput,
): Promise<MemoryWriteResult> {
  return invoke<MemoryWriteResult>("submit_memory_write", { input });
}
