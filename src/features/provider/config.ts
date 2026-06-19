import type { ProviderConfig } from "./types";

export interface ProviderDraft {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ProviderDraftField = keyof ProviderDraft;
export type ProviderDraftErrors = Partial<Record<ProviderDraftField, string>>;

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
};

interface ValidationOptions {
  requireApiKey?: boolean;
  requireModel?: boolean;
}

export function createProviderDraft(
  config: ProviderConfig = DEFAULT_PROVIDER_CONFIG,
): ProviderDraft {
  return {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
  };
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
  const requireApiKey = options.requireApiKey ?? true;
  const requireModel = options.requireModel ?? true;

  if (!draft.baseUrl.trim()) {
    errors.baseUrl = "Base URL 不能为空。";
  } else if (!isHttpUrl(draft.baseUrl.trim())) {
    errors.baseUrl = "Base URL 必须是 http/https 绝对地址。";
  }

  if (requireApiKey && !draft.apiKey.trim()) {
    errors.apiKey = "API Key 不能为空。";
  }

  if (requireModel && !draft.model.trim()) {
    errors.model = "请先获取并选择模型。";
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
