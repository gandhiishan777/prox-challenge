"use client";

import * as React from "react";

import { SseDecoder } from "@/lib/events";
import { useChat } from "@/lib/store";

/**
 * Sends a message and feeds the SSE response into the store.
 *
 * EventSource cannot POST, so this is fetch + a stream reader. The AbortController
 * is exposed as `stop()`, which both ends the render and tells the server to
 * abort the agent.
 */
export function useChatStream() {
  const abortRef = React.useRef<AbortController | null>(null);

  const send = React.useCallback(async (text: string) => {
    const store = useChat.getState();
    if (store.busy) return;

    store.addUserMessage(text);
    store.beginAssistant();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: store.sessionId ?? undefined,
          model: store.model,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response.json().catch(() => null);
        useChat
          .getState()
          .failAssistant(detail?.error ?? `Request failed (${response.status}).`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const sse = new SseDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of sse.push(decoder.decode(value, { stream: true }))) {
          useChat.getState().applyEvent(event);
        }
      }
      useChat.getState().finishAssistant();
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        useChat.getState().finishAssistant();
      } else {
        useChat.getState().failAssistant((err as Error).message);
      }
    } finally {
      abortRef.current = null;
    }
  }, []);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { send, stop };
}
