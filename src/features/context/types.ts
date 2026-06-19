export type ContextSourceKind = "voice" | "echo_live" | "vision";

export type ContextStatusTone = "ok" | "warn" | "error" | "info";

export interface ContextEventInput {
  source: ContextSourceKind;
  content: string;
  occurredAt?: number;
  confidence?: number;
  summary?: string;
}

export interface ContextEvent {
  id: string;
  source: ContextSourceKind;
  content: string;
  summary: string;
  occurredAt: number;
  receivedAt: number;
  confidence?: number;
  status: string;
}

export interface ContextSourceStatus {
  source: ContextSourceKind;
  label: string;
  statusLabel: string;
  tone: ContextStatusTone;
  summary: string;
  lastEventAt?: number;
  eventCount: number;
}

export interface ContextWindowSnapshot {
  windowStartedAt: number;
  windowSeconds: number;
  events: ContextEvent[];
  sourceStatuses: ContextSourceStatus[];
}
