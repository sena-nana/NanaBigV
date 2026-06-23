import type { ContextStatusTone } from "./types";

export const DEFAULT_ECHO_LIVE_WS_URL = "ws://127.0.0.1:3000";

export type EchoLiveConnectionState = "idle" | "connecting" | "connected" | "error";

export interface EchoLiveConnectionStatus {
  state: EchoLiveConnectionState;
  url: string;
  statusLabel: string;
  tone: ContextStatusTone;
  lastMessageAt?: number;
  error?: string;
  diagnostics: EchoLiveDiagnostics;
}

export type EchoLiveDiscardKind =
  | "invalid_json"
  | "non_message_data"
  | "empty_message_data";

export interface EchoLiveDiagnosticEvent {
  kind: EchoLiveDiscardKind | "submit_failed";
  reason: string;
  happenedAt: number;
  rawPreview?: string;
}

export interface EchoLiveDiagnostics {
  discardedCount: number;
  submitFailureCount: number;
  lastDiscard?: EchoLiveDiagnosticEvent;
  lastSubmitFailure?: EchoLiveDiagnosticEvent;
}

export interface EchoLiveTextPayload {
  content: string;
  summary: string;
}

interface EchoLiveClientOptions {
  url?: string;
  submitText: (payload: EchoLiveTextPayload) => Promise<void>;
  onStatusChange: (status: EchoLiveConnectionStatus) => void;
  now?: () => number;
  webSocketFactory?: (url: string) => WebSocketLike;
}

interface WebSocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

const WEBSOCKET_OPEN = 1;

export function createInitialEchoLiveConnectionStatus(
  url = DEFAULT_ECHO_LIVE_WS_URL,
): EchoLiveConnectionStatus {
  return {
    state: "idle",
    url,
    statusLabel: "未连接",
    tone: "info",
    diagnostics: createInitialEchoLiveDiagnostics(),
  };
}

export function parseEchoLiveMessage(raw: unknown): EchoLiveTextPayload | null {
  const envelope = parseJsonObject(raw);
  return envelope ? parseEchoLiveEnvelope(envelope) : null;
}

function parseEchoLiveEnvelope(envelope: Record<string, unknown>): EchoLiveTextPayload | null {
  if (!envelope || envelope.action !== "message_data") return null;
  const data = asRecord(envelope.data);
  if (!data) return null;

  const username = typeof data.username === "string" ? data.username.trim() : "";
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const text = messages
    .map((item) => asRecord(item)?.message)
    .filter((message): message is string => typeof message === "string")
    .map((message) => message.trim())
    .filter(Boolean)
    .join("\n");

  if (!text) return null;
  const content = username ? `${username}：${text}` : text;
  return {
    content,
    summary: limitChars(content, 120),
  };
}

export class EchoLiveWebSocketClient {
  private socket: WebSocketLike | null = null;
  private status: EchoLiveConnectionStatus;

  constructor(private readonly options: EchoLiveClientOptions) {
    this.status = createInitialEchoLiveConnectionStatus(this.url);
    this.notify();
  }

  connect() {
    if (this.socket && this.status.state !== "error") return;
    this.closeSocket();
    this.setStatus({
      state: "connecting",
      url: this.url,
      statusLabel: "连接中",
      tone: "info",
    });

    try {
      const socket = this.createSocket();
      this.socket = socket;
      socket.onopen = () => {
        this.setStatus({
          state: "connected",
          url: this.url,
          statusLabel: "已连接",
          tone: "ok",
        });
        this.sendHello();
      };
      socket.onmessage = (event) => {
        void this.handleMessage(event.data);
      };
      socket.onerror = () => {
        this.fail("Echo-Live WebSocket 连接异常");
      };
      socket.onclose = () => {
        if (this.status.state === "error") {
          this.socket = null;
          this.notify();
          return;
        }
        this.socket = null;
        this.setStatus({
          state: "idle",
          url: this.url,
          statusLabel: "未连接",
          tone: "info",
        });
      };
    } catch (error) {
      this.fail(`Echo-Live WebSocket 创建失败：${toErrorMessage(error)}`);
    }
  }

  disconnect() {
    this.closeSocket();
    this.setStatus({
      state: "idle",
      url: this.url,
      statusLabel: "未连接",
      tone: "info",
    });
  }

  getStatus() {
    return { ...this.status };
  }

  private async handleMessage(raw: unknown) {
    const envelope = parseJsonObject(raw);
    if (!envelope) {
      this.recordDiscard("invalid_json", "收到无法解析的 JSON 消息", raw);
      return;
    }

    if (envelope?.action === "ping") {
      this.recordDiscard("non_message_data", "非 message_data 消息：ping（已回应 hello）", raw);
      this.sendHello();
      return;
    }
    if (envelope.action !== "message_data") {
      this.recordDiscard(
        "non_message_data",
        `非 message_data 消息：${formatAction(envelope.action)}`,
        raw,
      );
      return;
    }

    const payload = parseEchoLiveEnvelope(envelope);
    if (!payload) {
      this.recordDiscard("empty_message_data", "message_data 缺少可提交文本", raw);
      return;
    }

    try {
      await this.options.submitText(payload);
      this.setStatus({
        state: "connected",
        url: this.url,
        statusLabel: "已连接",
        tone: "ok",
        lastMessageAt: this.now(),
      });
    } catch (error) {
      const message = `提交 Echo-Live 文本失败：${toErrorMessage(error)}`;
      this.recordSubmitFailure(message, raw);
      this.fail(message);
    }
  }

  private sendHello() {
    if (!this.socket || this.socket.readyState !== WEBSOCKET_OPEN) return;
    this.socket.send(JSON.stringify({ action: "hello" }));
  }

  private fail(error: string) {
    this.closeSocket();
    this.setStatus({
      state: "error",
      url: this.url,
      statusLabel: "异常",
      tone: "error",
      error,
    });
  }

  private closeSocket() {
    if (!this.socket) return;
    const socket = this.socket;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    this.socket = null;
    socket.close();
  }

  private createSocket() {
    if (this.options.webSocketFactory) return this.options.webSocketFactory(this.url);
    return new WebSocket(this.url);
  }

  private notify() {
    this.options.onStatusChange(this.getStatus());
  }

  private recordDiscard(kind: EchoLiveDiscardKind, reason: string, raw: unknown) {
    const diagnostics = this.status.diagnostics;
    this.setDiagnostics({
      ...diagnostics,
      discardedCount: diagnostics.discardedCount + 1,
      lastDiscard: {
        kind,
        reason,
        happenedAt: this.now(),
        rawPreview: previewRawMessage(raw),
      },
    });
  }

  private recordSubmitFailure(reason: string, raw: unknown) {
    const diagnostics = this.status.diagnostics;
    this.setDiagnostics({
      ...diagnostics,
      submitFailureCount: diagnostics.submitFailureCount + 1,
      lastSubmitFailure: {
        kind: "submit_failed",
        reason,
        happenedAt: this.now(),
        rawPreview: previewRawMessage(raw),
      },
    });
  }

  private setDiagnostics(diagnostics: EchoLiveDiagnostics) {
    this.status = { ...this.status, diagnostics };
    this.notify();
  }

  private setStatus(status: Omit<EchoLiveConnectionStatus, "diagnostics">) {
    this.status = {
      ...status,
      diagnostics: this.status.diagnostics,
    };
    this.notify();
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  private get url() {
    return this.options.url ?? DEFAULT_ECHO_LIVE_WS_URL;
  }
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    return asRecord(parsed);
  } catch {
    return null;
  }
}

function createInitialEchoLiveDiagnostics(): EchoLiveDiagnostics {
  return {
    discardedCount: 0,
    submitFailureCount: 0,
  };
}

function formatAction(action: unknown) {
  if (typeof action === "string" && action.trim()) return action;
  return "未知 action";
}

function previewRawMessage(raw: unknown) {
  const value = typeof raw === "string" ? raw : String(raw);
  return limitChars(value, 240);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function limitChars(value: string, limit: number) {
  const chars = Array.from(value);
  return chars.length > limit ? `${chars.slice(0, limit).join("")}...` : value;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
