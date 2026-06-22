import { generateProviderJson } from "../provider/api";
import type { ProviderError } from "../provider/types";
import type { BlivechatEventInput } from "./eventRuntime";
import {
  buildAudienceBatchGenerationPrompt,
  parseAudienceBatchGenerationResult,
  type AudienceBatchGenerationRequest,
} from "./audiencePlanner";

const RESPONSE_SNIPPET_LIMIT = 240;

export interface AudienceProviderBatchGenerationSuccess {
  ok: true;
  events: BlivechatEventInput[];
  latencyMs: number;
  model: string;
}

export interface AudienceProviderBatchGenerationFailure {
  ok: false;
  error: ProviderError;
}

export type AudienceProviderBatchGenerationResult =
  | AudienceProviderBatchGenerationSuccess
  | AudienceProviderBatchGenerationFailure;

export async function generateAudienceBatch(
  request: AudienceBatchGenerationRequest,
): Promise<AudienceProviderBatchGenerationResult> {
  let providerResult: Awaited<ReturnType<typeof generateProviderJson>>;
  try {
    providerResult = await generateProviderJson(buildAudienceBatchGenerationPrompt(request));
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "transport",
        message: `provider 命令不可用：${errorMessage(error)}`,
      },
    };
  }

  if (!providerResult.ok) {
    return { ok: false, error: providerResult.error };
  }

  const parsed = parseAudienceBatchGenerationResult(providerResult.content, request);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: parsed.error,
        responseBodySnippet: providerResult.content.trim().slice(0, RESPONSE_SNIPPET_LIMIT),
      },
    };
  }

  return {
    ok: true,
    events: parsed.events,
    latencyMs: providerResult.latencyMs,
    model: providerResult.model,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
