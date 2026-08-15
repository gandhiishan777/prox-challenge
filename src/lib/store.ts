"use client";

import { create } from "zustand";

import type { AgentEvent } from "./events";
import type { Artifact } from "./artifacts/types";

/**
 * Chat state.
 *
 * Zustand rather than context because artifact code streams in at chunk cadence:
 * only the code pane should re-render on each delta, not the whole transcript.
 */

export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "artifact"; identifier: string }
  | { kind: "figure"; figureId: string; title: string; caption: string; src: string; citation: string }
  | { kind: "options"; question: string; options: string[] };

export interface Message {
  id: string;
  role: "user" | "assistant";
  parts: MessagePart[];
  /** Tool activity for the current turn, shown while the agent works. */
  activity: { id: string; label: string; done: boolean }[];
  streaming: boolean;
  error?: string;
}

interface ChatState {
  messages: Message[];
  artifacts: Record<string, Artifact>;
  sessionId: string | null;
  model: "sonnet" | "opus";
  busy: boolean;
  lastCostUsd: number | null;

  panel: {
    open: boolean;
    identifier: string | null;
    version: number;
    view: "preview" | "code";
    /** Set once the user picks a view, so streaming stops overriding them. */
    pinned: boolean;
  };

  setModel: (model: "sonnet" | "opus") => void;
  addUserMessage: (text: string) => void;
  beginAssistant: () => void;
  applyEvent: (event: AgentEvent) => void;
  finishAssistant: () => void;
  failAssistant: (message: string) => void;
  openArtifact: (identifier: string, version?: number) => void;
  closePanel: () => void;
  setView: (view: "preview" | "code") => void;
  setVersion: (version: number) => void;
  reset: () => void;
}

let counter = 0;
const nextId = () => `m${++counter}`;

/** Append text to the trailing text part, or start a new one. */
function appendText(parts: MessagePart[], text: string): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last?.kind === "text") {
    return [...parts.slice(0, -1), { kind: "text", text: last.text + text }];
  }
  return [...parts, { kind: "text", text }];
}

/** Close the current paragraph so following text starts a new one. */
function endParagraph(parts: MessagePart[]): MessagePart[] {
  const last = parts[parts.length - 1];
  if (last?.kind !== "text" || !last.text.trim() || last.text.endsWith("\n\n")) {
    return parts;
  }
  return appendText(parts, "\n\n");
}

export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  artifacts: {},
  sessionId: null,
  model: "sonnet",
  busy: false,
  lastCostUsd: null,
  panel: { open: false, identifier: null, version: 0, view: "preview", pinned: false },

  setModel: (model) => set({ model }),

  addUserMessage: (text) =>
    set((state) => ({
      messages: [
        ...state.messages,
        { id: nextId(), role: "user", parts: [{ kind: "text", text }], activity: [], streaming: false },
      ],
    })),

  beginAssistant: () =>
    set((state) => ({
      busy: true,
      messages: [
        ...state.messages,
        { id: nextId(), role: "assistant", parts: [], activity: [], streaming: true },
      ],
    })),

  applyEvent: (event) => {
    const state = get();
    const messages = [...state.messages];
    const index = messages.length - 1;
    const current = messages[index];
    if (!current || current.role !== "assistant") return;

    switch (event.type) {
      case "session":
        set({ sessionId: event.sessionId });
        return;

      case "text":
        messages[index] = { ...current, parts: appendText(current.parts, event.delta) };
        break;

      case "tool_start":
        messages[index] = {
          ...current,
          activity: [...current.activity, { id: event.id, label: event.label, done: false }],
          // A tool call ends the current paragraph. Without this break, the text
          // written before the call and the text written after it get glued
          // together mid-sentence ("...guess at any of it.Now the second...").
          parts: endParagraph(current.parts),
        };
        break;

      case "tool_end":
        messages[index] = {
          ...current,
          activity: current.activity.map((a) =>
            a.id === event.id ? { ...a, done: true } : a,
          ),
        };
        break;

      case "figure":
        messages[index] = {
          ...current,
          parts: [
            ...current.parts,
            {
              kind: "figure",
              figureId: event.figureId,
              title: event.title,
              caption: event.caption,
              src: event.src,
              citation: event.citation,
            },
          ],
        };
        break;

      case "options":
        messages[index] = {
          ...current,
          parts: [...current.parts, { kind: "options", question: event.question, options: event.options }],
        };
        break;

      case "artifact_start": {
        const existing = state.artifacts[event.identifier];
        // Reusing an identifier means "update this artifact" — push a version
        // rather than creating a second card, matching claude.ai's semantics.
        const artifact: Artifact = existing
          ? {
              ...existing,
              title: event.title,
              type: event.artifactType,
              language: event.language,
              versions: [...existing.versions, { code: "", complete: false }],
              streaming: true,
            }
          : {
              identifier: event.identifier,
              type: event.artifactType,
              title: event.title,
              language: event.language,
              versions: [{ code: "", complete: false }],
              streaming: true,
            };

        const alreadyReferenced = current.parts.some(
          (p) => p.kind === "artifact" && p.identifier === event.identifier,
        );
        messages[index] = alreadyReferenced
          ? current
          : { ...current, parts: [...current.parts, { kind: "artifact", identifier: event.identifier }] };

        set({
          artifacts: { ...state.artifacts, [event.identifier]: artifact },
          panel: {
            open: true,
            identifier: event.identifier,
            version: artifact.versions.length - 1,
            // Show the code streaming in, unless the user has chosen a view.
            view: state.panel.pinned ? state.panel.view : "code",
            pinned: state.panel.pinned,
          },
          messages,
        });
        return;
      }

      case "artifact_delta": {
        const artifact = state.artifacts[event.identifier];
        if (!artifact) return;
        const versions = [...artifact.versions];
        const last = versions.length - 1;
        versions[last] = { ...versions[last], code: versions[last].code + event.delta };
        set({
          artifacts: { ...state.artifacts, [event.identifier]: { ...artifact, versions } },
        });
        return;
      }

      case "artifact_end": {
        const artifact = state.artifacts[event.identifier];
        if (!artifact) return;
        const versions = [...artifact.versions];
        const last = versions.length - 1;
        versions[last] = { ...versions[last], complete: event.complete };
        set({
          artifacts: {
            ...state.artifacts,
            [event.identifier]: { ...artifact, versions, streaming: false },
          },
          panel: {
            ...state.panel,
            // Flip to the running artifact once it is whole, unless the user
            // deliberately chose the code view.
            view: state.panel.pinned ? state.panel.view : "preview",
          },
        });
        return;
      }

      case "error":
        messages[index] = { ...current, error: event.message };
        break;

      case "done":
        set({ lastCostUsd: event.costUsd ?? null });
        break;
    }

    set({ messages });
  },

  finishAssistant: () =>
    set((state) => {
      const messages = [...state.messages];
      const index = messages.length - 1;
      if (messages[index]?.role === "assistant") {
        messages[index] = { ...messages[index], streaming: false };
      }
      return { messages, busy: false };
    }),

  failAssistant: (message) =>
    set((state) => {
      const messages = [...state.messages];
      const index = messages.length - 1;
      if (messages[index]?.role === "assistant") {
        messages[index] = { ...messages[index], streaming: false, error: message };
      }
      return { messages, busy: false };
    }),

  openArtifact: (identifier, version) =>
    set((state) => ({
      panel: {
        open: true,
        identifier,
        version: version ?? (state.artifacts[identifier]?.versions.length ?? 1) - 1,
        view: "preview",
        pinned: false,
      },
    })),

  closePanel: () => set((state) => ({ panel: { ...state.panel, open: false } })),
  setView: (view) => set((state) => ({ panel: { ...state.panel, view, pinned: true } })),
  setVersion: (version) => set((state) => ({ panel: { ...state.panel, version } })),

  reset: () =>
    set({
      messages: [],
      artifacts: {},
      sessionId: null,
      busy: false,
      lastCostUsd: null,
      panel: { open: false, identifier: null, version: 0, view: "preview", pinned: false },
    }),
}));
