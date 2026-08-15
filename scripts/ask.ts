/**
 * CLI harness: ask the agent one question and print the answer plus its tool trace.
 *
 * Exists so agent accuracy can be iterated on before any UI exists, and so the
 * tool trace is visible — the trace is how you tell a correct answer from a
 * lucky one.
 *
 * Usage:
 *   npm run ask -- "What's the duty cycle for MIG at 200A on 240V?"
 *   npm run ask -- --model opus "..."
 */
import { runAgent, type ModelChoice } from "../src/lib/agent/run";
import { describeToolCall } from "../src/lib/agent/tools";

const argv = process.argv.slice(2);
let model: ModelChoice = "sonnet";
const modelIdx = argv.indexOf("--model");
if (modelIdx !== -1) {
  model = argv[modelIdx + 1] as ModelChoice;
  argv.splice(modelIdx, 2);
}
const prompt = argv.join(" ").trim();

if (!prompt) {
  console.error('usage: npm run ask -- "your question"');
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set (expected in .env)");
  process.exit(1);
}

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const orange = (s: string) => `\x1b[38;5;208m${s}\x1b[0m`;

async function main() {
  console.log(orange(`\n> ${prompt}\n`));

  const toolCalls: string[] = [];
  let answer = "";

  for await (const message of runAgent({ prompt, model })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          const label = describeToolCall(block.name, block.input as Record<string, unknown>);
          toolCalls.push(block.name);
          console.log(dim(`  ⚙ ${label}`));
        } else if (block.type === "text") {
          // Separate blocks are separate paragraphs; joining them bare glues
          // sentences together across a tool call.
          answer += (answer && !answer.endsWith("\n") ? "\n\n" : "") + block.text;
        }
      }
    }
    if (message.type === "result") {
      console.log(`\n${answer.trim()}\n`);
      console.log(dim("─".repeat(60)));
      console.log(
        dim(
          `${toolCalls.length} tool calls · ${
            message.subtype === "success" ? "ok" : message.subtype
          } · $${(message as { total_cost_usd?: number }).total_cost_usd?.toFixed(4) ?? "?"}`,
        ),
      );
      // Cache hit rate is the number that matters for cost here: the system
      // prompt carries the whole manual, so it must be read from cache rather
      // than re-sent as fresh input on every turn.
      const usage = (message as unknown as { usage?: Record<string, number> }).usage;
      if (usage) {
        console.log(
          dim(
            `tokens  in:${usage.input_tokens ?? 0}` +
              `  cache_write:${usage.cache_creation_input_tokens ?? 0}` +
              `  cache_read:${usage.cache_read_input_tokens ?? 0}` +
              `  out:${usage.output_tokens ?? 0}`,
          ),
        );
      }
      console.log(dim(`session: ${message.session_id}`));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
