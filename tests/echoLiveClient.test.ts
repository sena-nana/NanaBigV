import { describe, expect, it, vi } from "vitest";
import {
  EchoLiveWebSocketClient,
  parseEchoLiveMessage,
  type EchoLiveConnectionStatus,
  type EchoLiveTextPayload,
} from "../src/features/context/echoLiveClient";

describe("Echo-Live WebSocket client", () => {
  it("extracts message_data text payloads", () => {
    const payload = parseEchoLiveMessage(
      JSON.stringify({
        action: "message_data",
        data: {
          username: "娜娜",
          messages: [{ message: "第一句" }, { message: "第二句" }],
        },
      }),
    );

    expect(payload).toEqual({
      content: "娜娜：第一句\n第二句",
      summary: "娜娜：第一句\n第二句",
    });
  });

  it("ignores non-text Echo-Live messages", () => {
    expect(parseEchoLiveMessage(JSON.stringify({ action: "ping" }))).toBeNull();
    expect(parseEchoLiveMessage("not-json")).toBeNull();
    expect(parseEchoLiveMessage(JSON.stringify({ action: "message_data", data: { messages: [] } }))).toBeNull();
    expect(
      parseEchoLiveMessage(JSON.stringify({ action: "message_data", data: { messages: [{ message: "   " }] } })),
    ).toBeNull();
  });

  it("sends hello and submits text after message_data", async () => {
    const socket = new MockSocket();
    const submitted: EchoLiveTextPayload[] = [];
    let status: EchoLiveConnectionStatus | null = null;
    const client = new EchoLiveWebSocketClient({
      submitText: async (payload) => {
        submitted.push(payload);
      },
      onStatusChange: (next) => {
        status = next;
      },
      now: () => 10_000,
      webSocketFactory: () => socket,
    });

    client.connect();
    socket.open();

    expect(socket.sent).toEqual([JSON.stringify({ action: "hello" })]);
    expect(status).toMatchObject({ state: "connected", statusLabel: "已连接" });

    socket.message(JSON.stringify({ action: "ping" }));
    expect(socket.sent).toEqual([JSON.stringify({ action: "hello" }), JSON.stringify({ action: "hello" })]);

    socket.message(
      JSON.stringify({
        action: "message_data",
        data: {
          messages: [{ message: "Echo-Live 捕获到台词" }],
        },
      }),
    );
    await vi.waitFor(() => {
      expect(submitted).toEqual([
        {
          content: "Echo-Live 捕获到台词",
          summary: "Echo-Live 捕获到台词",
        },
      ]);
    });
    expect(status).toMatchObject({ state: "connected", lastMessageAt: 10_000 });
  });
});

class MockSocket {
  readyState = 0;
  sent: string[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  message(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }
}
