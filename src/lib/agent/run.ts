import { query } from "@anthropic-ai/claude-agent-sdk";

import { SYSTEM_PROMPT } from "./systemPrompt";
import { ALLOWED_TOOLS, SERVER_NAME, welderMcpServer } from "./tools";

/**
 * One place that configures the agent, shared by the web route, the CLI harness
 * and the eval runner — so what the evaluator sees in the browser is exactly
 * what the eval suite measured.
 */

export type ModelChoice = "sonnet" | "opus";

export const MODEL_IDS: Record<ModelChoice, string> = {
  // Sonnet is the default: with the deterministic lookup tools carrying the
  // numeric load, it answers accurately at a fraction of the cost and latency.
  // Opus is offered as a toggle for the hardest cross-referencing questions.
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-5",
};

export interface RunOptions {
  prompt: string;
  model?: ModelChoice;
  /** Resume a previous session so multi-turn context survives across HTTP requests. */
  resume?: string;
  abortController?: AbortController;
}

export function agentOptions(opts: RunOptions) {
  return {
    // The full documentation lives in the system prompt; see DECISIONS.md #2.
    systemPrompt: SYSTEM_PROMPT,
    mcpServers: { [SERVER_NAME]: welderMcpServer },
    allowedTools: ALLOWED_TOOLS,
    // Built-in tools are disabled: this agent has no business touching the
    // filesystem or shell, and every unused tool definition is wasted context.
    tools: [],
    // Belt and braces. `tools: []` is the documented way to drop the built-ins,
    // but a harness-provided `repl` tool was still observed executing, so the
    // dangerous ones are also named explicitly — disallowedTools removes a tool
    // from the model's context entirely rather than merely leaving it unapproved.
    disallowedTools: [
      "repl",
      "Bash",
      "BashOutput",
      "KillShell",
      "Read",
      "Write",
      "Edit",
      "NotebookEdit",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "Task",
      "Agent",
      "TodoWrite",
      "Skill",
    ],
    // Do not inherit the developer's local CLAUDE.md or settings — the agent must
    // behave identically on the evaluator's machine.
    settingSources: [],
    permissionMode: "bypassPermissions" as const,
    includePartialMessages: true,
    // Enough headroom for look-up, verify-by-viewing, then answer.
    maxTurns: 12,
    model: MODEL_IDS[opts.model ?? "sonnet"],
    ...(opts.resume ? { resume: opts.resume } : {}),
    ...(opts.abortController ? { abortController: opts.abortController } : {}),
  };
}

export function runAgent(opts: RunOptions) {
  return query({ prompt: opts.prompt, options: agentOptions(opts) });
}
