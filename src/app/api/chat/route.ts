import { NextRequest } from "next/server";

import { encodeEvent, type AgentEvent } from "@/lib/events";
import { ArtifactStreamParser } from "@/lib/artifacts/parser";
import { runAgent, type ModelChoice } from "@/lib/agent/run";
import { describeToolCall, figureSideEffect, machineSideEffect } from "@/lib/agent/tools";

/**
 * Bridges the Claude Agent SDK to the browser over SSE.
 *
 * The SDK spawns a subprocess and streams for as long as the answer takes, so
 * this must run on the Node runtime with no static optimization.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ChatRequest {
  message: string;
  sessionId?: string;
  model?: ModelChoice;
}

export async function POST(request: NextRequest) {
  const { message, sessionId, model } = (await request.json()) as ChatRequest;

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({
        error:
          "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  // Cancelling the fetch on the client aborts the agent rather than leaving the
  // subprocess running and billing for an answer nobody will read.
  const abortController = new AbortController();
  request.signal.addEventListener("abort", () => abortController.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const parser = new ArtifactStreamParser();
      let closed = false;

      const send = (event: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      /** Artifact/options markup is stripped here, so the client sees clean text. */
      const emitText = (delta: string) => {
        for (const event of parser.push(delta)) {
          if (event.type === "text") send({ type: "text", delta: event.text });
          else send(event as AgentEvent);
        }
      };

      /**
       * Must run on every exit path, not just a clean result. If the stream is
       * aborted mid-artifact, `artifact_start` and its deltas have already been
       * sent; without the matching `artifact_end` the client leaves the artifact
       * marked streaming and its chip spins forever.
       */
      let flushed = false;
      const flushParser = () => {
        if (flushed) return;
        flushed = true;
        for (const event of parser.flush()) {
          if (event.type === "text") send({ type: "text", delta: event.text });
          else send(event as AgentEvent);
        }
      };

      try {
        for await (const sdkMessage of runAgent({
          prompt: message,
          model,
          resume: sessionId,
          abortController,
        })) {
          if (sdkMessage.type === "system" && sdkMessage.subtype === "init") {
            send({ type: "session", sessionId: sdkMessage.session_id });
          }

          // Incremental text for the typing effect.
          if (sdkMessage.type === "stream_event") {
            const event = sdkMessage.event as {
              type: string;
              delta?: { type: string; text?: string };
            };
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              emitText(event.delta.text);
            }
          }

          // Complete assistant turns carry the tool calls; the text has already
          // been streamed above, so only tool activity is handled here.
          if (sdkMessage.type === "assistant") {
            for (const block of sdkMessage.message.content) {
              if (block.type !== "tool_use") continue;
              const input = block.input as Record<string, unknown>;
              send({
                type: "tool_start",
                id: block.id,
                label: describeToolCall(block.name, input),
              });
              // show_figure and show_machine_view tell the UI to display something.
              const figure = figureSideEffect(block.name, input);
              if (figure) send({ type: "figure", ...figure });
              const machine = machineSideEffect(block.name, input);
              if (machine) send({ type: "machine", ...machine });
              send({ type: "tool_end", id: block.id });
            }
          }

          if (sdkMessage.type === "result") {
            flushParser();
            if (sdkMessage.subtype !== "success") {
              send({
                type: "error",
                message: `The agent stopped early (${sdkMessage.subtype}).`,
              });
            }
            send({
              type: "done",
              costUsd: (sdkMessage as { total_cost_usd?: number }).total_cost_usd,
            });
          }
        }
      } catch (err) {
        flushParser();
        if (!abortController.signal.aborted) {
          send({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
          send({ type: "done" });
        }
      } finally {
        flushParser();
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Proxies that buffer would defeat streaming entirely.
      "x-accel-buffering": "no",
    },
  });
}
