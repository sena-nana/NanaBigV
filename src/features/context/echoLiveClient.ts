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
    this.status = {
      state: "connecting",
      url: this.url,
      statusLabel: "连接中",
      tone: "info",
    };
    this.notify();

    try {
      const socket = this.createSocket();
      this.socket = socket;
      socket.onopen = () => {
        this.status = {
          state: "connected",
          url: this.url,
          statusLabel: "已连接",
          tone: "ok",
        };
        this.sendHello();
        this.notify();
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
        this.status = createInitialEchoLiveConnectionStatus(this.url);
        this.notify();
      };
    } catch (error) {
      this.fail(`Echo-Live WebSocket 创建失败：${toErrorMessage(error)}`);
    }
  }

  disconnect() {
    this.closeSocket();
    this.status = createInitialEchoLiveConnectionStatus(this.url);
    this.notify();
  }

  getStatus() {
    return { ...this.status };
  }

  private async handleMessage(raw: unknown) {
    const envelope = parseJsonObject(raw);
    if (envelope?.action === "ping") {
      this.sendHello();
      return;
    }

    const payload = envelope ? parseEchoLiveEnvelope(envelope) : null;
    if (!payload) return;

    try {
      await this.options.submitText(payload);
      this.status = {
        state: "connected",
        url: this.url,
        statusLabel: "已连接",
        tone: "ok",
        lastMessageAt: this.now(),
      };
      this.notify();
    } catch (error) {
      this.fail(`提交 Echo-Live 文本失败：${toErrorMessage(error)}`);
    }
  }

  private sendHello() {
    if (!this.socket || this.socket.readyState !== WEBSOCKET_OPEN) return;
    this.socket.send(JSON.stringify({ action: "hello" }));
  }

  private fail(error: string) {
    this.closeSocket();
    this.status = {
      state: "error",
      url: this.url,
      statusLabel: "异常",
      tone: "error",
      error,
    };
    this.notify();
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
