"use client";

import { create } from "zustand";

import type { AgentEvent } from "./events";
import type { Artifact } from "./artifacts/types";
import { EMPTY_MACHINE, type MachineContext } from "./machineContext";

/**
 * Chat state.
 *
 * Zustand rather than context because artifact code streams in at chunk cadence:
 * only the code pane should re-render on each delta, not the whole transcript.
 */

export type MessagePart =
  | { kind: "text"; text: string }
  | { kind: "artifact"; identifier: string }
  | {
      kind: "figure";
      figureId: string;
      title: string;
      caption: string;
      src: string;
      citation: string;
      pageId: string;
    }
  | { kind: "machine"; view: string; highlight: string[]; title: string; citation: string }
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

/** Something the session surfaced, listed in the reference rail. */
export interface Pull {
  kind: "figure" | "artifact";
  id: string;
  title: string;
  /** Figures carry a thumbnail; artifacts get a TOOL tile instead. */
  thumb?: string;
  citation?: string;
  pageId?: string;
}

interface ChatState {
  messages: Message[];
  artifacts: Record<string, Artifact>;
  sessionId: string | null;
  model: "sonnet" | "opus";
  busy: boolean;
  lastCostUsd: number | null;
  sessionCostUsd: number;

  /** What the user's welder is set to. Sent with every message. */
  machine: MachineContext;

  /** Everything pulled up this session, newest last, deduplicated. */
  pulls: Pull[];
  /** Page ids cited so far, in first-cited order — drives the manual filmstrip. */
  citedPages: string[];
  lookups: number;
  figureCount: number;

  panel: {
    open: boolean;
    /** The right-hand panel shows either a generated tool or a manual page. */
    mode: "artifact" | "manual";
    identifier: string | null;
    version: number;
    view: "preview" | "code";
    /** Set once the user picks a view, so streaming stops overriding them. */
    pinned: boolean;
    /** Page id when mode is "manual". */
    page: string | null;
  };

  setModel: (model: "sonnet" | "opus") => void;
  setMachine: (patch: Partial<MachineContext>) => void;
  addUserMessage: (text: string) => void;
  beginAssistant: () => void;
  applyEvent: (event: AgentEvent) => void;
  finishAssistant: () => void;
  failAssistant: (message: string) => void;
  openArtifact: (identifier: string, version?: number) => void;
  openManual: (pageId: string) => void;
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

/** Page ids the assistant cited in a chunk of prose, e.g. "(p. 7, p. 19)". */
function citedIn(text: string): string[] {
  return [...text.matchAll(/\bp\.\s*(\d{1,2})\b/g)].map(
    (m) => `om-${m[1].padStart(2, "0")}`,
  );
}

/** Add without duplicating, preserving first-seen order. */
function pushUnique<T>(list: T[], item: T, key: (x: T) => string): T[] {
  return list.some((x) => key(x) === key(item)) ? list : [...list, item];
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
  sessionCostUsd: 0,
  machine: EMPTY_MACHINE,
  pulls: [],
  citedPages: [],
  lookups: 0,
  figureCount: 0,
  panel: {
    open: false,
    mode: "artifact",
    identifier: null,
    version: 0,
    view: "preview",
    pinned: false,
    page: null,
  },

  setModel: (model) => set({ model }),

  setMachine: (patch) =>
    set((state) => {
      const machine = { ...state.machine, ...patch };
      // Changing process invalidates a consumable that process cannot take.
      if (patch.process && patch.process !== state.machine.process) {
        machine.wire = null;
      }
      return { machine };
    }),

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

      case "text": {
        messages[index] = { ...current, parts: appendText(current.parts, event.delta) };
        // Citations are collected as they stream so the manual filmstrip fills
        // in during the answer rather than after it.
        const cited = citedIn(event.delta);
        if (cited.length) {
          const next = [...state.citedPages];
          for (const page of cited) if (!next.includes(page)) next.push(page);
          if (next.length !== state.citedPages.length) set({ citedPages: next });
        }
        break;
      }

      case "tool_start":
        set({ lookups: state.lookups + 1 });
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

      case "figure": {
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
              pageId: event.pageId,
            },
          ],
        };
        const citedPages = state.citedPages.includes(event.pageId)
          ? state.citedPages
          : [...state.citedPages, event.pageId];
        set({
          figureCount: state.figureCount + 1,
          citedPages,
          pulls: pushUnique(
            state.pulls,
            {
              kind: "figure",
              id: event.figureId,
              title: event.title,
              thumb: event.src,
              citation: event.citation,
              pageId: event.pageId,
            },
            (p) => `${p.kind}:${p.id}`,
          ),
        });
        break;
      }

      case "machine":
        messages[index] = {
          ...current,
          parts: [
            ...current.parts,
            {
              kind: "machine",
              view: event.view,
              highlight: event.highlight,
              title: event.title,
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
          pulls: pushUnique(
            state.pulls,
            { kind: "artifact", id: event.identifier, title: event.title },
            (p) => `${p.kind}:${p.id}`,
          ),
          panel: {
            ...state.panel,
            open: true,
            mode: "artifact",
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
        set({
          lastCostUsd: event.costUsd ?? null,
          sessionCostUsd: state.sessionCostUsd + (event.costUsd ?? 0),
        });
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
        ...state.panel,
        open: true,
        mode: "artifact",
        identifier,
        version: version ?? (state.artifacts[identifier]?.versions.length ?? 1) - 1,
        view: "preview",
        pinned: false,
      },
    })),

  openManual: (pageId) =>
    set((state) => ({
      panel: { ...state.panel, open: true, mode: "manual", page: pageId },
      // Opening a page counts as citing it, so it joins the filmstrip.
      citedPages: state.citedPages.includes(pageId)
        ? state.citedPages
        : [...state.citedPages, pageId],
    })),

  closePanel: () => set((state) => ({ panel: { ...state.panel, open: false } })),
  setView: (view) => set((state) => ({ panel: { ...state.panel, view, pinned: true } })),
  setVersion: (version) => set((state) => ({ panel: { ...state.panel, version } })),

  reset: () =>
    set((state) => ({
      messages: [],
      artifacts: {},
      sessionId: null,
      busy: false,
      lastCostUsd: null,
      sessionCostUsd: 0,
      pulls: [],
      citedPages: [],
      lookups: 0,
      figureCount: 0,
      // The machine setup survives a new session — it describes the user's
      // bench, not the conversation.
      machine: state.machine,
      panel: {
        open: false,
        mode: "artifact",
        identifier: null,
        version: 0,
        view: "preview",
        pinned: false,
        page: null,
      },
    })),
}));
