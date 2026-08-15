/**
 * Eval harness.
 *
 * Runs the gold set through the same agent configuration the web app uses, and
 * grades each answer twice:
 *
 *   - Programmatic gates over the tool trace and answer text. These are the ones
 *     that catch the failure this whole design is built to prevent: a number
 *     stated without a lookup behind it, or a "which socket" answer given without
 *     ever displaying the diagram.
 *   - An LLM judge for fact coverage and tone, which a regex cannot assess.
 *
 * Usage:
 *   npm run eval                 # whole set
 *   npm run eval -- --only tig-polarity,fluxcore-porosity
 *   npm run eval -- --model opus
 */
import fs from "node:fs";
import path from "node:path";

import Anthropic from "@anthropic-ai/sdk";

import { runAgent, type ModelChoice } from "../src/lib/agent/run";
import { ArtifactStreamParser } from "../src/lib/artifacts/parser";
import { SERVER_NAME } from "../src/lib/agent/tools";

interface GoldCase {
  id: string;
  category: string;
  question: string;
  must_use_tools?: string[];
  must_show_figure?: string;
  must_cite_pages?: string[];
  must_contain?: string[];
  must_contain_any?: string[];
  must_not_contain?: string[];
  must_ask_options?: boolean;
  must_emit_artifact?: boolean;
  facts: string[];
  followup?: string;
  followup_facts?: string[];
  followup_must_not_contain?: string[];
}

interface TurnResult {
  text: string;
  tools: { name: string; input: Record<string, unknown> }[];
  figures: string[];
  artifacts: string[];
  optionsAsked: boolean;
  sessionId: string | null;
  costUsd: number;
}

const ROOT = path.join(process.cwd());
const gold = JSON.parse(
  fs.readFileSync(path.join(ROOT, "eval", "gold.json"), "utf8"),
) as { cases: GoldCase[] };

const argv = process.argv.slice(2);
const onlyArg = argv.indexOf("--only");
const only = onlyArg !== -1 ? argv[onlyArg + 1].split(",") : null;
const modelArg = argv.indexOf("--model");
const model = (modelArg !== -1 ? argv[modelArg + 1] : "sonnet") as ModelChoice;

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

async function runTurn(prompt: string, resume?: string): Promise<TurnResult> {
  const parser = new ArtifactStreamParser();
  const result: TurnResult = {
    text: "",
    tools: [],
    figures: [],
    artifacts: [],
    optionsAsked: false,
    sessionId: resume ?? null,
    costUsd: 0,
  };

  const consume = (events: ReturnType<ArtifactStreamParser["push"]>) => {
    for (const event of events) {
      if (event.type === "text") result.text += event.text;
      else if (event.type === "artifact_start") result.artifacts.push(event.identifier);
      else if (event.type === "options") result.optionsAsked = true;
    }
  };

  for await (const message of runAgent({ prompt, model, resume })) {
    if (message.type === "system" && message.subtype === "init") {
      result.sessionId = message.session_id;
    }
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text") consume(parser.push(block.text));
        if (block.type === "tool_use") {
          const input = block.input as Record<string, unknown>;
          result.tools.push({ name: block.name, input });
          if (block.name === `mcp__${SERVER_NAME}__show_figure`) {
            result.figures.push(String(input.figure_id));
          }
        }
      }
    }
    if (message.type === "result") {
      consume(parser.flush());
      result.costUsd = (message as { total_cost_usd?: number }).total_cost_usd ?? 0;
    }
  }
  return result;
}

interface Gate {
  name: string;
  ok: boolean;
  detail?: string;
}

function checkGates(c: GoldCase, turn: TurnResult): Gate[] {
  const gates: Gate[] = [];
  const text = turn.text.toLowerCase();
  const toolNames = turn.tools.map((t) => t.name.replace(`mcp__${SERVER_NAME}__`, ""));

  for (const tool of c.must_use_tools ?? []) {
    gates.push({
      name: `calls ${tool}`,
      ok: toolNames.includes(tool),
      detail: toolNames.join(", ") || "(no tools)",
    });
  }
  if (c.must_show_figure) {
    gates.push({
      name: `shows ${c.must_show_figure}`,
      ok: turn.figures.includes(c.must_show_figure),
      detail: turn.figures.join(", ") || "(no figures)",
    });
  }
  for (const page of c.must_cite_pages ?? []) {
    gates.push({ name: `cites ${page}`, ok: turn.text.includes(page) });
  }
  for (const needle of c.must_contain ?? []) {
    gates.push({ name: `says "${needle}"`, ok: text.includes(needle.toLowerCase()) });
  }
  // `must_contain_any` exists because a single required substring tests the
  // agent's word choice rather than whether it is right — a correct refusal that
  // opens with "No —" should not fail a check for the word "not".
  if (c.must_contain_any?.length) {
    gates.push({
      name: `says one of [${c.must_contain_any.join(" | ")}]`,
      ok: c.must_contain_any.some((n) => text.includes(n.toLowerCase())),
    });
  }
  for (const needle of c.must_not_contain ?? []) {
    gates.push({
      name: `avoids "${needle}"`,
      ok: !text.includes(needle.toLowerCase()),
    });
  }
  if (c.must_ask_options) {
    gates.push({ name: "asks a clarifying question", ok: turn.optionsAsked });
  }
  if (c.must_emit_artifact) {
    gates.push({
      name: "emits an artifact",
      ok: turn.artifacts.length > 0,
      detail: turn.artifacts.join(", ") || "(none)",
    });
  }
  return gates;
}

const client = new Anthropic();

async function judge(
  question: string,
  answer: string,
  facts: string[],
): Promise<{ coverage: number; tone: number; notes: string }> {
  const response = await client.messages.create({
    // A cheaper model is enough to check whether stated facts are present.
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    temperature: 0,
    system:
      "You grade answers from a welding-machine support agent. Be strict about facts and lenient about phrasing. Reply ONLY with JSON.",
    messages: [
      {
        role: "user",
        content: `QUESTION:\n${question}\n\nANSWER:\n${answer}\n\nFACTS THAT SHOULD BE CONVEYED:\n${facts
          .map((f, i) => `${i + 1}. ${f}`)
          .join("\n")}\n\nReturn JSON:
{"coverage": <0-1, fraction of the listed facts correctly conveyed>,
 "tone": <1-5, is this direct and practical for a competent home hobbyist standing at the machine? penalise corporate filler, praise concrete specifics>,
 "notes": "<one sentence on anything wrong or missing>"}`,
      },
    ],
  });
  const block = response.content[0];
  const raw = block.type === "text" ? block.text : "{}";
  try {
    const match = /\{[\s\S]*\}/.exec(raw);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { coverage: 0, tone: 0, notes: `unparseable judge output: ${raw.slice(0, 120)}` };
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set (expected in .env)");
    process.exit(1);
  }

  const cases = gold.cases.filter((c) => !only || only.includes(c.id));
  console.log(bold(`\nRunning ${cases.length} cases on ${model}\n`));

  const results: Record<string, unknown>[] = [];
  let passed = 0;
  let totalCost = 0;

  for (const c of cases) {
    process.stdout.write(dim(`  ${c.id} … `));
    const turn = await runTurn(c.question);
    totalCost += turn.costUsd;

    const gates = checkGates(c, turn);
    const verdict = await judge(c.question, turn.text, c.facts);

    // A clarification case is judged on the follow-up answer, since the first
    // turn is supposed to be a question rather than an answer.
    let followup: TurnResult | null = null;
    let followupVerdict: Awaited<ReturnType<typeof judge>> | null = null;
    if (c.followup && turn.sessionId) {
      followup = await runTurn(c.followup, turn.sessionId);
      totalCost += followup.costUsd;
      followupVerdict = await judge(
        c.followup,
        followup.text,
        c.followup_facts ?? c.facts,
      );
      for (const needle of c.followup_must_not_contain ?? []) {
        gates.push({
          name: `follow-up avoids "${needle}"`,
          ok: !followup.text.toLowerCase().includes(needle.toLowerCase()),
        });
      }
    }

    const gatesOk = gates.every((g) => g.ok);
    const coverage = followupVerdict?.coverage ?? verdict.coverage;
    const ok = gatesOk && coverage >= 0.6;
    if (ok) passed++;

    console.log(
      ok
        ? green(`pass`) + dim(` (coverage ${(coverage * 100).toFixed(0)}%, tone ${verdict.tone})`)
        : red(`FAIL`) +
            dim(
              ` (coverage ${(coverage * 100).toFixed(0)}%) ` +
                gates
                  .filter((g) => !g.ok)
                  .map((g) => `✗ ${g.name}${g.detail ? ` [${g.detail}]` : ""}`)
                  .join(" "),
            ),
    );
    if (!ok && verdict.notes) console.log(dim(`      judge: ${verdict.notes}`));

    results.push({
      id: c.id,
      category: c.category,
      ok,
      gates,
      coverage,
      tone: verdict.tone,
      notes: verdict.notes,
      tools: turn.tools.map((t) => t.name),
      figures: turn.figures,
      artifacts: turn.artifacts,
      answer: turn.text,
      followup: followup ? { answer: followup.text, verdict: followupVerdict } : undefined,
      costUsd: turn.costUsd,
    });
  }

  const dir = path.join(ROOT, "eval", "results");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ model, passed, total: cases.length, results }, null, 2));

  const pct = ((passed / cases.length) * 100).toFixed(0);
  console.log(
    bold(`\n${passed}/${cases.length} passed (${pct}%)`) +
      dim(`  ·  $${totalCost.toFixed(2)}  ·  ${file}\n`),
  );
  process.exit(passed === cases.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
