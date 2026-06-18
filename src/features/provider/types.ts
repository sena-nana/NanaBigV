export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  topP: number;
  timeoutSeconds: number;
}

export type ProviderResponseFormat = "text" | "jsonObject";

export type ProviderErrorKind =
  | "invalid_config"
  | "timeout"
  | "transport"
  | "http_status"
  | "invalid_response";

export interface ProviderError {
  kind: ProviderErrorKind;
  message: string;
  statusCode?: number;
  responseBodySnippet?: string;
}

export interface ProviderProbeSuccess {
  ok: true;
  latencyMs: number;
  model: string;
  message: string;
  error?: undefined;
}

export interface ProviderProbeFailure {
  ok: false;
  error: ProviderError;
  latencyMs?: undefined;
  model?: undefined;
  message?: undefined;
}

export type ProviderProbeResult = ProviderProbeSuccess | ProviderProbeFailure;
