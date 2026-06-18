import type { ProviderConfig } from "./types";

export interface ProviderDraft {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: string;
  topP: string;
  timeoutSeconds: string;
}

export type ProviderDraftField = keyof ProviderDraft;
export type ProviderDraftErrors = Partial<Record<ProviderDraftField, string>>;

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
  temperature: 0.7,
  topP: 1,
  timeoutSeconds: 30,
};

interface ValidationOptions {
  requireCredentials?: boolean;
}

export function createProviderDraft(
  config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
): ProviderDraft {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    temperature: String(config.temperature),
    topP: String(config.topP),
    timeoutSeconds: String(config.timeoutSeconds),
  };
}

function parseDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number | null {
  const parsed = parseDecimal(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProviderDraft(
  draft: ProviderDraft,
  options: ValidationOptions = {},
): ProviderDraftErrors {
  const errors: ProviderDraftErrors = {};

  if (!draft.baseUrl.trim()) {
    errors.baseUrl = "Base URL 不能为空。";
  } else if (!isHttpUrl(draft.baseUrl.trim())) {
    errors.baseUrl = "Base URL 必须是 http/https 绝对地址。";
  }

  if (options.requireCredentials !== false) {
    if (!draft.apiKey.trim()) {
      errors.apiKey = "API Key 不能为空。";
    }
    if (!draft.model.trim()) {
      errors.model = "模型名不能为空。";
    }
  }

  const temperature = parseDecimal(draft.temperature);
  if (temperature === null || temperature < 0 || temperature > 2) {
    errors.temperature = "temperature 必须在 0 到 2 之间。";
  }

  const topP = parseDecimal(draft.topP);
  if (topP === null || topP < 0 || topP > 1) {
    errors.topP = "top_p 必须在 0 到 1 之间。";
  }

  const timeoutSeconds = parseInteger(draft.timeoutSeconds);
  if (timeoutSeconds === null || timeoutSeconds < 1 || timeoutSeconds > 300) {
    errors.timeoutSeconds = "超时必须是 1 到 300 秒之间的整数。";
  }

  return errors;
}

export function parseProviderDraft(
  draft: ProviderDraft,
  options: ValidationOptions = {},
): { config: ProviderConfig | null; errors: ProviderDraftErrors } {
  const errors = validateProviderDraft(draft, options);
  if (Object.keys(errors).length > 0) {
    return { config: null, errors };
  }

  return {
    config: {
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
      temperature: Number(draft.temperature.trim()),
      topP: Number(draft.topP.trim()),
      timeoutSeconds: Number(draft.timeoutSeconds.trim()),
    },
    errors,
  };
}

export function firstProviderError(errors: ProviderDraftErrors): string | null {
  for (const key of Object.keys(errors) as ProviderDraftField[]) {
    const message = errors[key];
    if (message) return message;
  }
  return null;
}
