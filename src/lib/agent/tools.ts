import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import {
  cite,
  figuresById,
  manifest,
  pagesById,
  parts,
  readImageBase64,
} from "./knowledge";
import { getPart, getView, MACHINE_MAP, MACHINE_VIEWS } from "../machine/map";
import {
  getAllConnections,
  getConnections,
  getSpecs,
  getWeldSettings,
  lookupDutyCycle,
  lookupPart,
  lookupTroubleshooting,
  type Process,
} from "./lookups";

/**
 * The agent's tool surface.
 *
 * Two kinds of tool live here. Most are deterministic lookups over the curated
 * knowledge pack — they exist so that every number the user sees is retrieved
 * rather than recalled. The other two return images, which is how the agent
 * both *sees* the manual's visual content and *shows* it to the user.
 */

const PROCESS = z
  .enum(["MIG", "FLUX_CORED", "TIG", "STICK"])
  .describe("Welding process. FLUX_CORED is self-shielded flux-cored wire.");

const json = (value: unknown) => JSON.stringify(value, null, 1);

/** Emitted when a tool wants the UI to display something; the SSE relay picks these up. */
export interface FigureSideEffect {
  figureId: string;
  title: string;
  caption: string;
  src: string;
  citation: string;
}

const dutyCycleTool = tool(
  "lookup_duty_cycle",
  "Look up the rated duty cycle for a process at a given amperage and input voltage. Use this for ANY question about how long the machine can weld continuously, overheating, or thermal shutdown. The manual publishes only two rated points per process and voltage, so this returns bracketing values rather than interpolating.",
  {
    process: PROCESS,
    input_voltage: z
      .union([z.literal(120), z.literal(240), z.string()])
      .describe("Input supply voltage: 120 or 240. Sloppy values like '230V' are normalized."),
    amps: z.number().describe("Welding output current in amps."),
  },
  async (args) => {
    const result = lookupDutyCycle(
      args.process as Process,
      args.input_voltage as string | number,
      args.amps,
    );
    return { content: [{ type: "text", text: json(result) }] };
  },
);

const connectionsTool = tool(
  "get_connections",
  "Get the polarity and which socket each lead goes into for a process (or all four). Use this for ANY question about polarity, DCEP/DCEN, which socket the ground clamp / work clamp / torch / gun / electrode holder goes in, or switching between processes.",
  {
    process: PROCESS.optional().describe("Omit to get all four processes for comparison."),
  },
  async (args) => {
    const result = args.process
      ? getConnections(args.process as Process)
      : { all: getAllConnections() };
    return {
      content: [
        {
          type: "text",
          text:
            json(result) +
            "\n\nThere is a figure for each of these — call show_figure with the figure_id to show the user the actual hookup diagram.",
        },
      ],
    };
  },
);

const troubleshootingTool = tool(
  "lookup_troubleshooting",
  "Find causes and remedies for a symptom: weld defects (porosity, spatter, burn-through, crooked bead) and machine faults (wire not feeding, bird's nest, unstable arc, no power). Pass the process when known — several causes in the manual apply to MIG only, and this filters them out for flux-cored.",
  {
    symptom: z.string().describe("The problem in the user's own words."),
    process: PROCESS.optional(),
  },
  async (args) => {
    const matches = lookupTroubleshooting(
      args.symptom,
      (args.process as Process) ?? null,
    );
    if (!matches.length) {
      return {
        content: [
          {
            type: "text",
            text: "No matching entry in the manual's troubleshooting tables or weld diagnosis pages. Say so rather than guessing, and consider asking what the weld or machine is actually doing.",
          },
        ],
      };
    }
    const payload = matches.map((m) => ({
      id: m.entry.id,
      symptom: m.entry.symptom,
      applies_to: m.entry.applies_to,
      causes: m.causes,
      figures: m.entry.figures,
      filtered_note: m.filtered_note,
    }));
    return { content: [{ type: "text", text: json(payload) }] };
  },
);

const specsTool = tool(
  "get_specs",
  "Get published specifications: output ranges and current draw per process and input voltage, weldable materials, wire and electrode sizes, process selection criteria, and capability limits (such as this machine being DC TIG only).",
  {
    topic: z
      .enum([
        "all",
        "output",
        "connections",
        "limits",
        "selection",
        "comparison",
        "gas",
        "product",
      ])
      .default("all")
      .describe(
        "'output' for amperage ranges, 'selection' for the process selection chart, 'comparison' for MIG vs flux-cored, 'limits' for what the machine cannot do.",
      ),
  },
  async (args) => {
    return { content: [{ type: "text", text: json(getSpecs(args.topic)) }] };
  },
);

const settingsTool = tool(
  "get_weld_settings",
  "Get guidance on setting wire feed speed and voltage. IMPORTANT: the manual publishes no settings table — the machine computes these synergically from process, wire diameter and material thickness. Call this before answering any 'what settings for X' question so you give the real procedure instead of inventing numbers.",
  {
    process: PROCESS.optional(),
    material: z.string().optional().describe("e.g. 'mild steel', 'stainless', 'aluminium'."),
    thickness: z
      .string()
      .optional()
      .describe("Accepts '1/8', '0.125', '11 gauge', '24 ga'."),
  },
  async (args) => {
    const result = getWeldSettings(
      (args.process as Process) ?? null,
      args.thickness ?? null,
    );
    return { content: [{ type: "text", text: json(result) }] };
  },
);

const partsTool = tool(
  "lookup_part",
  "Look up a part by reference number from the assembly diagram, or by description.",
  { query: z.string().describe("A reference number like '34', or text like 'drive roll'.") },
  async (args) => {
    const matches = lookupPart(args.query);
    return {
      content: [
        {
          type: "text",
          text: matches.length
            ? json({
                matches,
                total_parts: parts.entries.length,
                note: "Reference numbers key into the exploded assembly diagram (figure id 'assembly-diagram').",
              })
            : `No part matched "${args.query}". The parts list has ${parts.entries.length} entries keyed 1-61 to the assembly diagram.`,
        },
      ],
    };
  },
);

const viewPageTool = tool(
  "view_page",
  "Look at a page of the documentation yourself. Use this before describing any diagram, schematic, table or photo you are not certain of. Page ids are 'om-NN' for the owner's manual, 'qs-01'/'qs-02' for the quick start guide, and 'sc-01' for the selection chart.",
  {
    page_id: z
      .string()
      .describe("Page id such as 'om-07' (specifications) or 'om-45' (wiring schematic)."),
  },
  async (args) => {
    const page = pagesById.get(args.page_id);
    if (!page) {
      const known = manifest.pages
        .slice(0, 5)
        .map((p) => p.id)
        .join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Unknown page id "${args.page_id}". Ids look like: ${known}, ... through om-48, plus qs-01, qs-02, sc-01.`,
          },
        ],
        isError: true,
      };
    }
    const figuresHere = manifest.figures
      .filter((f) => f.page_id === page.id)
      .map((f) => f.id);
    return {
      content: [
        {
          type: "image",
          data: readImageBase64(page.image),
          mimeType: "image/png",
        },
        {
          type: "text",
          text: `${page.doc_title}, ${page.citation} (section: ${page.section}).${
            figuresHere.length
              ? ` Figures croppable from this page: ${figuresHere.join(", ")}.`
              : ""
          }`,
        },
      ],
    };
  },
);

const showFigureTool = tool(
  "show_figure",
  "Display one of the manual's figures to the user, and see it yourself. Use this instead of describing a diagram in words: hookup and polarity diagrams, control locations, the wire feed mechanism, weld defect photos, the selection chart, the wiring schematic.",
  {
    figure_id: z.string().describe("A figure id from the catalogue in your instructions."),
    reason: z
      .string()
      .optional()
      .describe("One short phrase on why this figure answers the question."),
  },
  async (args) => {
    const figure = figuresById.get(args.figure_id);
    if (!figure) {
      // Suggest near matches so a wrong guess self-corrects in one turn.
      const q = args.figure_id.toLowerCase();
      const near = manifest.figures
        .map((f) => ({
          id: f.id,
          score:
            (f.id.includes(q) || q.includes(f.id) ? 3 : 0) +
            f.keywords.filter((k) => q.includes(k.toLowerCase())).length,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((f) => f.id);
      return {
        content: [
          {
            type: "text",
            text: `No figure "${args.figure_id}". Closest ids: ${near.join(", ")}.`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "image",
          data: readImageBase64(figure.file),
          mimeType: "image/png",
        },
        {
          type: "text",
          text: `Displayed to the user: "${figure.title}" (${cite(
            figure.page_id,
          )}). ${figure.caption}\n\nYou are looking at the same image. Describe only what is actually in it, and cite ${cite(
            figure.page_id,
          )}.`,
        },
      ],
    };
  },
);

const machineViewTool = tool(
  "show_machine_view",
  "Display an interactive diagram of the machine with specific parts highlighted, and point the user at exactly what to touch. Use this during setup and troubleshooting: 'the tensioner is here', 'plug the ground clamp into this socket', 'check the drive roll'. Views: 'front-panel' (display, knobs, power switch, output sockets) and 'interior' (wire spool, feed mechanism, tensioner, drive roll, feed-control sockets). Prefer this over describing a location in words.",
  {
    view: z
      .enum(["front-panel", "interior"])
      .describe("Which diagram: the front panel or the interior wire compartment."),
    highlight: z
      .array(z.string())
      .describe("Part ids to highlight, from the machine part catalogue in your instructions."),
    reason: z.string().optional().describe("One short phrase on what you are pointing at and why."),
  },
  async (args) => {
    const view = getView(args.view);
    if (!view) {
      return {
        content: [{ type: "text", text: `Unknown view "${args.view}". Use 'front-panel' or 'interior'.` }],
        isError: true,
      };
    }
    const resolved = args.highlight.map((id) => ({ id, part: getPart(args.view, id) }));
    const unknown = resolved.filter((r) => !r.part).map((r) => r.id);
    if (unknown.length) {
      const known = view.parts.map((p) => p.id).join(", ");
      return {
        content: [
          {
            type: "text",
            text: `Unknown part id(s) for ${args.view}: ${unknown.join(", ")}. Valid ids: ${known}.`,
          },
        ],
        isError: true,
      };
    }
    const detail = resolved
      .map((r) => `- ${r.part!.label}: ${r.part!.note}`)
      .join("\n");
    return {
      content: [
        {
          type: "text",
          text:
            `Displayed the ${view.title} diagram to the user with these parts highlighted (${cite(view.page)}):\n${detail}\n\n` +
            `Describe only what these highlighted parts are and how they relate; the user can see the diagram.`,
        },
      ],
    };
  },
);

export const TOOLS = [
  dutyCycleTool,
  connectionsTool,
  troubleshootingTool,
  specsTool,
  settingsTool,
  partsTool,
  viewPageTool,
  showFigureTool,
  machineViewTool,
];

export const SERVER_NAME = "omnipro";

export const welderMcpServer = createSdkMcpServer({
  name: SERVER_NAME,
  version: "1.0.0",
  tools: TOOLS,
});

/** Fully-qualified names, as the SDK namespaces in-process MCP tools. */
export const ALLOWED_TOOLS = [
  "lookup_duty_cycle",
  "get_connections",
  "lookup_troubleshooting",
  "get_specs",
  "get_weld_settings",
  "lookup_part",
  "view_page",
  "show_figure",
  "show_machine_view",
].map((name) => `mcp__${SERVER_NAME}__${name}`);

/** Short label for a tool call, shown in the UI as the agent works. */
export function describeToolCall(name: string, input: Record<string, unknown>): string {
  const bare = name.replace(`mcp__${SERVER_NAME}__`, "");
  switch (bare) {
    case "lookup_duty_cycle":
      return `Checking duty cycle for ${input.process} at ${input.amps}A on ${input.input_voltage}V`;
    case "get_connections":
      return input.process
        ? `Checking ${input.process} polarity and sockets`
        : "Checking polarity for all processes";
    case "lookup_troubleshooting":
      return `Searching troubleshooting for "${String(input.symptom ?? "").slice(0, 48)}"`;
    case "get_specs":
      return `Reading specifications (${input.topic ?? "all"})`;
    case "get_weld_settings":
      return "Checking settings guidance";
    case "lookup_part":
      return `Looking up part "${String(input.query ?? "").slice(0, 32)}"`;
    case "view_page":
      return `Reading ${cite(String(input.page_id))}`;
    case "show_figure":
      return `Showing ${figuresById.get(String(input.figure_id))?.title ?? input.figure_id}`;
    case "show_machine_view": {
      const n = Array.isArray(input.highlight) ? input.highlight.length : 0;
      return `Pointing at ${n} part${n === 1 ? "" : "s"} on the ${input.view} diagram`;
    }
    default:
      return bare;
  }
}

/** If this tool call should surface an image in the chat, describe it. */
export function figureSideEffect(
  name: string,
  input: Record<string, unknown>,
): FigureSideEffect | null {
  if (name !== `mcp__${SERVER_NAME}__show_figure`) return null;
  const figure = figuresById.get(String(input.figure_id));
  if (!figure) return null;
  return {
    figureId: figure.id,
    title: figure.title,
    caption: figure.caption,
    src: `/api/knowledge/${figure.file}`,
    citation: cite(figure.page_id),
  };
}

export interface MachineSideEffect {
  view: string;
  highlight: string[];
  title: string;
  citation: string;
}

/** If this tool call should surface the interactive machine diagram, describe it. */
export function machineSideEffect(
  name: string,
  input: Record<string, unknown>,
): MachineSideEffect | null {
  if (name !== `mcp__${SERVER_NAME}__show_machine_view`) return null;
  const view = getView(String(input.view));
  if (!view) return null;
  const highlight = Array.isArray(input.highlight)
    ? input.highlight.map(String).filter((id) => getPart(String(input.view), id))
    : [];
  return { view: String(input.view), highlight, title: view.title, citation: cite(view.page) };
}

/** Machine part catalogue for the system prompt, so the model knows the ids. */
export function machineCatalog(): string {
  return MACHINE_VIEWS.map((viewId) => {
    const view = MACHINE_MAP.views[viewId];
    const parts = view.parts.map((p) => `    ${p.id} — ${p.label}`).join("\n");
    return `  ${viewId} (${view.title}):\n${parts}`;
  }).join("\n");
}
